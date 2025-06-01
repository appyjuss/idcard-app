// server/db/migrations/YYYYMMDDHHMMSS_create_jobs_table.js
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('jobs', function(table) {
      table.increments('id').primary(); // Auto-incrementing primary key
  
      // Original filenames from upload
      table.string('original_csv_filename');
      table.string('original_template_filename');
      table.string('original_photos_zip_filename');
  
      // Server-side paths where files are stored for processing
      // These paths will be relative to a base 'uploads' directory or absolute
      // depending on your implementation. Storing relative is often cleaner.
      table.string('server_csv_path');       // e.g., 'jobs_data/123/data.csv'
      table.string('server_template_path');   // e.g., 'jobs_data/123/template.svg'
      table.string('server_photos_unzip_path'); // e.g., 'jobs_data/123/photos/' (directory)
  
      table.enum('status', [
          'pending_upload',       // Initial state, waiting for all files
          'pending_assets',       // Files received, pre-processing (unzip etc.)
          'queued',               // Assets processed, CSV parsed, cards ready for worker
          'processing',           // Worker is actively generating cards
          'completed',            // All cards generated successfully
          'completed_with_errors',// Some cards failed, but job is done
          'failed',               // Job failed critically (e.g., bad CSV, template error)
          'archived',             // User has downloaded, files might be moved
          'deleted'               // Marked for deletion by cleanup job
      ]).defaultTo('pending_upload');
  
      table.integer('total_cards').defaultTo(0);
      table.integer('processed_cards').defaultTo(0);
      table.integer('failed_cards').defaultTo(0); // New: track failed cards
  
      table.text('error_message'); // For job-level errors
  
      table.timestamp('expires_at'); // For TTL-based deletion (e.g., 24-48 hours from creation)
  
      table.timestamps(true, true); // Adds created_at and updated_at columns
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('jobs');
  };