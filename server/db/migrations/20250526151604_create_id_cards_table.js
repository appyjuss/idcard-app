// server/db/migrations/YYYYMMDDHHMMSS_create_id_cards_table.js
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('id_cards', function(table) {
      table.increments('id').primary();
      table.integer('job_id').unsigned().notNullable();
      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE'); // Foreign key
  
      // Crucial for linking to the uploaded photo.
      // This should match a filename within the unzipped photo directory.
      // e.g., "alice.jpg", "employee_101.png"
      table.string('photo_identifier').notNullable();
  
      // JSONB column to store all other dynamic key-value pairs from the CSV row.
      // e.g., {"Full Name": "Alice", "Class": "Grade 5", "Student ID": "S1001"}
      table.jsonb('card_data').notNullable();
  
      // Path to the generated ID card image/PDF for this specific card
      // e.g., 'output/123/card_1.png'
      table.string('output_file_path');
  
      table.enum('status', [
          'queued',       // Ready for worker
          'processing',   // Worker is generating this card
          'completed',    // Card generated successfully
          'failed'        // Card generation failed
      ]).defaultTo('queued');
  
      table.text('error_message'); // For card-specific errors
  
      table.timestamps(true, true);
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('id_cards');
  };