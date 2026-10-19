/**
 * @file 20260724010000-add-subscription-status-enum.cjs
 * @module Migrations
 * @description Migration bổ sung các giá trị ENUM 'grace_period' và 'suspended' cho bảng subscriptions.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TYPE enum_subscriptions_status ADD VALUE IF NOT EXISTS 'grace_period';
        ALTER TYPE enum_subscriptions_status ADD VALUE IF NOT EXISTS 'suspended';
      `);
      console.log('Successfully updated enum_subscriptions_status');
    } catch (error) {
      console.error('Failed to update enum_subscriptions_status:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Enum values removal in Postgres is not trivial and usually omitted
  }
};
