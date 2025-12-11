import { db } from './db';
import { templates, type Template, type NewTemplate } from './schema';
import { eq } from 'drizzle-orm';

export class TemplateController {
  
  static async getAllTemplates(): Promise<Template[]> {
    return await db.select().from(templates);
  }

  static async getTemplateById(id: number): Promise<Template | null> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    return template || null;
  }

  static async createTemplate(data: { name: string; displayName: string; config: string }): Promise<Template> {
    const [template] = await db.insert(templates).values({
      name: data.name,
      displayName: data.displayName,
      config: data.config,
      source: 'custom',
      editable: true,
    }).returning();
    return template;
  }

  static async updateTemplate(id: number, data: { displayName?: string; config?: string }): Promise<Template | null> {
    // Check if editable
    const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    if (!existing || !existing.editable) {
      return null;
    }

    const [updated] = await db.update(templates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return updated;
  }

  static async deleteTemplate(id: number): Promise<boolean> {
    // Check if editable
    const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
    if (!existing || !existing.editable) {
      return false;
    }

    await db.delete(templates).where(eq(templates.id, id));
    return true;
  }
}
