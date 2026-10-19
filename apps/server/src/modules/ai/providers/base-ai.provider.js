/**
 * @file base-ai.provider.js
 * @module AI_Base_Provider
 * @description Lớp trừu tượng định nghĩa hợp đồng chung cho các Nhà cung cấp AI (Provider-Agnostic Contract).
 */

export class BaseAIProvider {
  /**
   * @param {string} name - Tên định danh của Provider (gemini, openrouter, v.v.)
   */
  constructor(name) {
    if (new.target === BaseAIProvider) {
      throw new TypeError("Không thể khởi tạo trực tiếp lớp trừu tượng BaseAIProvider");
    }
    this.name = name;
  }

  /**
   * Sinh cấu trúc JSON từ Prompt đầu vào
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {number} [params.timeoutMs=25000]
   * @returns {Promise<Object>} { rawText, parsedJson, usage: { promptTokens, completionTokens, totalTokens }, model, latencyMs }
   */
  async generateStructuredOutput(params) {
    throw new Error(`Phương thức generateStructuredOutput chưa được triển khai tại ${this.name}`);
  }

  /**
   * Kiểm tra trạng thái sức khỏe (Health Check) của Provider
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return true;
  }
}

export default BaseAIProvider;
