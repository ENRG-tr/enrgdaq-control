import { db } from './db';
import { templates, type Template, type NewTemplate } from './schema';
import { eq } from 'drizzle-orm';

// Built-in templates that come with the system
const BUILTIN_TEMPLATES: NewTemplate[] = [
  {
    name: 'caen_digitizer.toml',
    displayName: 'CAEN Digitizer',
    source: 'builtin',
    editable: false,
    config: `daq_job_type = "DAQJobCAENDigitizer"
connection_type = "OPTICAL_LINK"
link_number = "1"
conet_node = 0
vme_base_address = 0
channel_enable_mask = 0b11
record_length = 1024
acquisition_mode = "SW_CONTROLLED"
[waveform_store_config.raw]
file_path = "caen_digitizer_waveforms.raw"
add_date = true
overwrite = true`,
  },
  {
    name: 'n1081b.toml',
    displayName: 'N1081B',
    source: 'builtin',
    editable: false,
    config: `daq_job_type = "DAQJobN1081B"
host = "1.2.3.4"
port = "8080"
password = "password"
[store_config.csv]
file_path = "n1081b.csv"
add_date = true`,
  },
  {
    name: 'test_gen.toml',
    displayName: 'Test Generator',
    source: 'builtin',
    editable: false,
    config: `daq_job_type = "DAQJobTest"
rand_min = 1
rand_max = 100
[store_config.csv]
file_path = "test.csv"
add_date = true`,
  },
];

export class TemplateController {
  
  // Seed built-in templates if they don't exist
  static async seedBuiltinTemplates(): Promise<void> {
    for (const template of BUILTIN_TEMPLATES) {
      const existing = await db.select().from(templates).where(eq(templates.name, template.name)).limit(1);
      if (existing.length === 0) {
        await db.insert(templates).values(template);
      }
    }
  }

  static async getAllTemplates(): Promise<Template[]> {
    // Ensure built-ins exist
    await this.seedBuiltinTemplates();
    return await db.select().from(templates);
  }

  static async getTemplateByName(name: string): Promise<Template | null> {
    const [template] = await db.select().from(templates).where(eq(templates.name, name)).limit(1);
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
