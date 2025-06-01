/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.alterTable('jobs', function(table) {
        table.timestamp('completed_at').nullable(); // Adds the column
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.alterTable('jobs', function(table) {
        table.dropColumn('completed_at'); // Removes it if rolled back
      });
};
