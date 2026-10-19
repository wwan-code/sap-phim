/**
 * Điều phối Xác thực (Auth Service Orchestrator)
 * 
 * @description Trung tâm điều phối các dịch vụ xác thực chuyên biệt của hệ thống.
 * Hợp nhất các dịch vụ Login, Registration, Password, và Token thành một giao diện (API) duy nhất để Controller sử dụng thuận tiện.
 */
import { loginService } from "./login.service.js";
import { registrationService } from "./registration.service.js";
import { passwordService } from "./password.service.js";
import { tokenService } from "./token.service.js";

// ════════════════════════════════════════
// HỢP NHẤT DỊCH VỤ (SERVICE AGGREGATION)
// ════════════════════════════════════════
/**
 * Xuất hợp nhất tất cả các phương thức từ các service thành phần.
 */
export const authService = {
  ...loginService,
  ...registrationService,
  ...passwordService,
  ...tokenService,
};

export default authService;
