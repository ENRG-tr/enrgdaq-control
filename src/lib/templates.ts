import { db } from './db';
import {
  templates,
  runTypes,
  templateRunTypes,
  templateParameters,
  runTypeParameterDefaults,
  type Template,
  type RunType,
  type TemplateParameter,
} from './schema';
import { eq, and } from 'drizzle-orm';

export type TemplateWithRunTypes = Template & { runTypeIds: number[] };

// Aggregated parameter with optional run type default
export type AggregatedParameter = TemplateParameter & {
  runTypeDefault?: string | null;
};

export class TemplateController {
  static async getAllRunTypes(): Promise<RunType[]> {
    return await db.select().from(runTypes);
  }

  /**
   * Get all template parameters aggregated for a run type.
   * Parameters come from all templates associated with this run type.
   * Includes run type defaults if set.
   */
  static async getAggregatedParametersForRunType(
    runTypeId: number
  ): Promise<AggregatedParameter[]> {
    // Get all parameters from templates associated with this run type
    const params = await db
      .select({
        id: templateParameters.id,
        templateId: templateParameters.templateId,
        name: templateParameters.name,
        displayName: templateParameters.displayName,
        type: templateParameters.type,
        defaultValue: templateParameters.defaultValue,
        required: templateParameters.required,
      })
      .from(templateParameters)
      .innerJoin(
        templateRunTypes,
        eq(templateParameters.templateId, templateRunTypes.templateId)
      )
      .where(eq(templateRunTypes.runTypeId, runTypeId));

    // Get run type defaults
    const defaults = await db
      .select()
      .from(runTypeParameterDefaults)
      .where(eq(runTypeParameterDefaults.runTypeId, runTypeId));

    const defaultsMap = new Map(
      defaults.map((d) => [d.parameterId, d.defaultValue])
    );

    // Deduplicate by name and add defaults
    const uniqueParams = new Map<string, AggregatedParameter>();
    for (const param of params) {
      if (!uniqueParams.has(param.name)) {
        uniqueParams.set(param.name, {
          ...param,
          runTypeDefault: defaultsMap.get(param.id) || null,
        });
      }
    }

    return Array.from(uniqueParams.values());
  }

  /**
   * Set a default value for a parameter on a run type
   */
  static async setRunTypeParameterDefault(
    runTypeId: number,
    parameterId: number,
    defaultValue: string
  ): Promise<void> {
    // Check if exists
    const [existing] = await db
      .select()
      .from(runTypeParameterDefaults)
      .where(
        and(
          eq(runTypeParameterDefaults.runTypeId, runTypeId),
          eq(runTypeParameterDefaults.parameterId, parameterId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(runTypeParameterDefaults)
        .set({ defaultValue })
        .where(eq(runTypeParameterDefaults.id, existing.id));
    } else {
      await db.insert(runTypeParameterDefaults).values({
        runTypeId,
        parameterId,
        defaultValue,
      });
    }
  }

  /**
   * Remove a default value for a parameter on a run type
   */
  static async removeRunTypeParameterDefault(
    runTypeId: number,
    parameterId: number
  ): Promise<void> {
    await db
      .delete(runTypeParameterDefaults)
      .where(
        and(
          eq(runTypeParameterDefaults.runTypeId, runTypeId),
          eq(runTypeParameterDefaults.parameterId, parameterId)
        )
      );
  }

  static async createRunType(data: {
    name: string;
    description?: string;
    requiredTags?: string[];
  }): Promise<RunType> {
    const [runType] = await db
      .insert(runTypes)
      .values({
        name: data.name,
        description: data.description,
        requiredTags: data.requiredTags,
      })
      .returning();
    return runType;
  }

  static async updateRunType(
    id: number,
    data: { name?: string; description?: string; requiredTags?: string[] }
  ): Promise<RunType | null> {
    const [updated] = await db
      .update(runTypes)
      .set(data)
      .where(eq(runTypes.id, id))
      .returning();
    return updated || null;
  }

  static async deleteRunType(id: number): Promise<boolean> {
    // NOTE: This might fail if referenced by runs or template_run_types.
    // For now, let's assume the user handles cascading or we let it error if referenced.
    // Ideally we should maybe delete from template_run_types first?
    // Delete run type defaults first
    await db
      .delete(runTypeParameterDefaults)
      .where(eq(runTypeParameterDefaults.runTypeId, id));
    await db.delete(templateRunTypes).where(eq(templateRunTypes.runTypeId, id));
    const result = await db.delete(runTypes).where(eq(runTypes.id, id));
    return result.length > 0; // Returning check might differ based on drier driver, but usually it returns deleted rows
  }

  /**
   * Update which templates are associated with a run type.
   * This replaces all existing associations with the new list.
   */
  static async updateRunTypeTemplates(
    runTypeId: number,
    templateIds: number[]
  ): Promise<void> {
    // Delete all existing associations for this run type
    await db
      .delete(templateRunTypes)
      .where(eq(templateRunTypes.runTypeId, runTypeId));

    // Insert new associations
    if (templateIds.length > 0) {
      await db.insert(templateRunTypes).values(
        templateIds.map((templateId) => ({
          templateId,
          runTypeId,
        }))
      );
    }
  }

  // ========== Templates ==========

  static async getAllTemplates(): Promise<TemplateWithRunTypes[]> {
    const allTemplates = await db.select().from(templates);
    const allRelations = await db.select().from(templateRunTypes);

    // Map relations to templates
    return allTemplates.map((t) => {
      const related = allRelations
        .filter((r) => r.templateId === t.id)
        .map((r) => r.runTypeId);
      return { ...t, runTypeIds: related };
    });
  }

  static async getTemplateById(
    id: number
  ): Promise<TemplateWithRunTypes | null> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    if (!template) return null;

    const relations = await db
      .select()
      .from(templateRunTypes)
      .where(eq(templateRunTypes.templateId, id));
    return { ...template, runTypeIds: relations.map((r) => r.runTypeId) };
  }

  static async createTemplate(data: {
    name: string;
    displayName: string;
    config: string;
    type?: string;
    runTypeIds?: number[];
    // Message template fields
    messageType?: string;
    payloadTemplate?: string;
    targetDaqJobType?: string | null;
    defaultClientId?: string | null;
  }): Promise<TemplateWithRunTypes> {
    return await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(templates)
        .values({
          name: data.name,
          displayName: data.displayName,
          config: data.config,
          type: data.type || 'normal',
          editable: true,
          messageType: data.messageType || null,
          payloadTemplate: data.payloadTemplate || null,
          targetDaqJobType: data.targetDaqJobType || null,
          defaultClientId: data.defaultClientId || null,
        })
        .returning();

      if (data.runTypeIds && data.runTypeIds.length > 0) {
        await tx.insert(templateRunTypes).values(
          data.runTypeIds.map((rid) => ({
            templateId: template.id,
            runTypeId: rid,
          }))
        );
      }

      return { ...template, runTypeIds: data.runTypeIds || [] };
    });
  }

  static async updateTemplate(
    id: number,
    data: {
      displayName?: string;
      config?: string;
      type?: string;
      runTypeIds?: number[];
      // Message template fields
      messageType?: string;
      payloadTemplate?: string;
      targetDaqJobType?: string | null;
      defaultClientId?: string | null;
    }
  ): Promise<TemplateWithRunTypes | null> {
    // Check if editable
    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    if (!existing || !existing.editable) {
      return null;
    }

    return await db.transaction(async (tx) => {
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (data.displayName !== undefined)
        updateData.displayName = data.displayName;
      if (data.config !== undefined) updateData.config = data.config;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.messageType !== undefined)
        updateData.messageType = data.messageType;
      if (data.payloadTemplate !== undefined)
        updateData.payloadTemplate = data.payloadTemplate;
      if (data.targetDaqJobType !== undefined)
        updateData.targetDaqJobType = data.targetDaqJobType;
      if (data.defaultClientId !== undefined)
        updateData.defaultClientId = data.defaultClientId;

      const [updated] = await tx
        .update(templates)
        .set(updateData)
        .where(eq(templates.id, id))
        .returning();

      if (data.runTypeIds !== undefined) {
        // Replace relations
        await tx
          .delete(templateRunTypes)
          .where(eq(templateRunTypes.templateId, id));

        if (data.runTypeIds.length > 0) {
          await tx.insert(templateRunTypes).values(
            data.runTypeIds.map((rid) => ({
              templateId: id,
              runTypeId: rid,
            }))
          );
        }
      }

      // Fetch fresh relations to return correct state
      const relations = await tx
        .select()
        .from(templateRunTypes)
        .where(eq(templateRunTypes.templateId, id));
      return { ...updated, runTypeIds: relations.map((r) => r.runTypeId) };
    });
  }

  static async deleteTemplate(id: number): Promise<boolean> {
    // Check if editable
    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    if (!existing || !existing.editable) {
      return false;
    }

    return await db.transaction(async (tx) => {
      // Delete junction rows and template parameters first
      await tx
        .delete(templateRunTypes)
        .where(eq(templateRunTypes.templateId, id));
      await tx
        .delete(templateParameters)
        .where(eq(templateParameters.templateId, id));
      await tx.delete(templates).where(eq(templates.id, id));
      return true;
    });
  }
}
