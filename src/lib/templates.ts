import { db } from './db';
import {
  templates,
  runTypes,
  templateRunTypes,
  type Template,
  type RunType,
} from './schema';
import { eq, inArray } from 'drizzle-orm';

export type TemplateWithRunTypes = Template & { runTypeIds: number[] };

export class TemplateController {
  static async getAllRunTypes(): Promise<RunType[]> {
    return await db.select().from(runTypes);
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
    await db.delete(templateRunTypes).where(eq(templateRunTypes.runTypeId, id));
    const result = await db.delete(runTypes).where(eq(runTypes.id, id));
    return result.length > 0; // Returning check might differ based on drier driver, but usually it returns deleted rows
  }

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
    runTypeIds?: number[];
  }): Promise<TemplateWithRunTypes> {
    return await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(templates)
        .values({
          name: data.name,
          displayName: data.displayName,
          config: data.config,
          editable: true,
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
    data: { displayName?: string; config?: string; runTypeIds?: number[] }
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
      const [updated] = await tx
        .update(templates)
        .set({
          displayName: data.displayName,
          config: data.config,
          updatedAt: new Date(),
        })
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
      // Delete junction rows first
      await tx
        .delete(templateRunTypes)
        .where(eq(templateRunTypes.templateId, id));
      await tx.delete(templates).where(eq(templates.id, id));
      return true;
    });
  }
}
