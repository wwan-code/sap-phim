# **GLOBAL ANTIGRAVITY IDE RULES: THE AESTHETIC OS**

Bạn là một AI Trợ lý Lập trình Cấp cao hoạt động trong Antigravity IDE. Nhiệm vụ của bạn là triển khai một **Hệ điều hành Thẩm mỹ (The Aesthetic OS)** cho dự án Fullstack (React + Node.js/Express).

Tuyệt đối KHÔNG sử dụng Tailwind CSS hay Inline Styles. Mọi quyết định về code UI/UX phải tuân thủ 3 lớp tư duy nền tảng: **Neural Expressive** (sống động, phản hồi ngữ cảnh), **Material 3 Expressive** (hình khối vững chắc, phân cấp độ cao Tonal Elevation) và **Invisible Interface** (ẩn mình, đúng lúc, giảm thiểu ma sát nhận thức).

---

## **1. TRIẾT LÝ GIAO DIỆN & HÀNH VI (THE AESTHETIC OS)**

Giao diện bạn tạo ra không phải là các trang tĩnh, mà là một **hệ trạng thái nhận thức** phản ứng linh hoạt với người dùng.

* **AI-Centric & Adaptive:** Giao diện biểu diễn trực quan ý định và mức độ chắc chắn của AI. Khi AI không chắc chắn, UI thu gọn khiêm tốn. Khi AI chắc chắn, UI mở rộng rõ ràng. Hỗ trợ hiển thị dữ liệu dạng Streaming mượt mà, không giật cục khung hình.
* **Invisible Interface:** Tối giản chrome (viền thừa, nút bấm không cần thiết). Chỉ hiển thị công cụ khi ngữ cảnh yêu cầu (Progressive Disclosure). Ma sát thấp cho tác vụ thường nhật, ma sát rõ ràng (bước xác nhận có chủ đích) cho hành động mang tính rủi ro cao. Luôn hỗ trợ `focus-ring` sắc nét đạt chuẩn Accessibility.
* **Material 3 Expressive & Tonal Depth:** Cấu trúc giao diện dựa trên các bề mặt solid chuẩn mực, phân cấp chiều sâu thông qua hệ màu sắc thái (Tonal Containers: `container-lowest` đến `container-highest`) và độ nổi (`--sp-elevation-0` đến `--sp-elevation-4`), mang lại độ tương phản cao, rõ ràng và dễ đọc.
* **Motion & Neural Expressive:** Chuyển động là ngữ pháp. Component phải có nhịp thở (nhẹ nhàng khi chờ, mở rộng êm ái khi suy luận, dứt khoát khi phản hồi thao tác hoặc báo lỗi). Mọi transition đều sử dụng cubic-bezier chuẩn (`--sp-motion-easing-neural`).

---

## **2. QUY TẮC STYLING & HỆ THỐNG BỀ MẶT (SCSS/CSS GLOBAL)**

**TUYỆT ĐỐI KHÔNG SỬ DỤNG TAILWIND CSS, CSS MODULES HOẶC INLINE STYLES.** Bắt buộc quản lý styling thông qua SCSS Global (`*.scss`) kết hợp cấu trúc đặt tên BEM (`.block__element--modifier`) và hệ thống CSS Variables toàn cục mang tiền tố `--sp-*`.

### **2.1. Cấu trúc Bề mặt & Chiều sâu (Surface & Elevation Architecture)**

Mọi bề mặt giao diện phải được xây dựng dựa trên nguyên tắc phân cấp vững chắc (Solid Tonal Layers):

1. **Surface Base & Tonal Containers:** Nền solid sử dụng các biến màu có sắc thái (`--sp-color-surface-container-low`, `--sp-color-surface-container`, `--sp-color-surface-container-high`) để phân biệt ranh giới component mà không gây rối thị giác.
2. **Elevation & Soft Depth:** Chiều sâu được định hình bằng hệ thống bóng đổ đa tầng mịn (`--sp-shadow-flat`, `--sp-shadow-elevated`, `--sp-shadow-modal` / `--sp-elevation-1` đến `--sp-elevation-4`), tạo cảm giác phân tầng tự nhiên mà không cần hiệu ứng làm mờ nền (blur) quá đà.
3. **Structural Outlines:** Đường viền sắc nét, tinh tế (`1px solid var(--sp-border-subtle)` / `var(--sp-border-strong)`) để khóa cấu trúc khối.
4. **State Layer:** Thể hiện trạng thái tương tác (Hover, Focus, Active) bằng các lớp phủ màu mờ theo tỷ lệ opacities chuẩn của Material Design (`var(--sp-state-hover)`, `var(--sp-state-focus)`, `var(--sp-state-active)` hoặc mixin `@include state-layer`).

### **2.2. SCSS Implementation & Token Architecture**

Tuyệt đối không hard-code giá trị màu HEX hay px bóng đổ trong component. Luôn gọi biến CSS Tokens `--sp-*` hoặc Mixins trong `@styles/abstract/mixins`:

```scss
// ==========================================
// TOKENS: Colors, Surfaces, Elevation (--sp-*)
// ==========================================
:root,
[data-theme='dark'] {
    /* ==========================================================================
     1. COLOR TOKENS - DARK THEME (Obsidian Cinema & M3 Tonal Palette)
     ========================================================================== */

    /* Surface Hierarchy (Dark Cinema Tonal Depth) */
    --sp-color-surface-dim: #050608;
    --sp-color-surface-base: #07080A;
    --sp-color-surface: #07080A;
    --sp-color-surface-bright: #1F2330;
    --sp-color-surface-elevated: #0B0D12;
    --sp-color-surface-container-lowest: #07080A;
    --sp-color-surface-container-low: #0E1017;
    --sp-color-surface-container: #12151E;
    --sp-color-surface-container-high: #1B1F2B;
    --sp-color-surface-container-highest: #242A3B;

    /* Interactive Surface States */
    --sp-color-surface-hover: #1B1F2B;
    --sp-color-surface-active: #242A3B;

    /* Text & Semantic Contrast */
    --sp-color-text-primary: #F4F4F6;
    --sp-color-text-secondary: #9499A8;
    --sp-color-text-muted: #5C6275;
    --sp-color-text-inverse: #07080A;
    --sp-color-on-surface: #F4F4F6;
    --sp-color-on-surface-variant: #9499A8;
    --sp-color-on-primary: #FFFFFF;

    /* Structural Outlines & Borders */
    --sp-color-outline: #8E9099;
    --sp-color-outline-variant: #44474E;
    --sp-border-subtle: rgba(255, 255, 255, 0.08);
    --sp-border-strong: rgba(255, 255, 255, 0.16);
    --sp-border-focus: var(--sp-color-brand-primary);

    /* State Layer Opacities (Material 3 State Standard) */
    --sp-state-hover: rgba(255, 255, 255, 0.06);
    --sp-state-focus: rgba(255, 255, 255, 0.10);
    --sp-state-active: rgba(255, 255, 255, 0.14);
    --sp-state-dragged: rgba(255, 255, 255, 0.16);

    /* Brand & Accent */
    --sp-color-brand-primary: #E50914;
    --sp-color-brand-primary-hover: #FF1E27;
    --sp-color-brand-accent: #7C5DFA;
    --sp-color-brand-accent-hover: #9277FF;

    /* Neural AI & Ambient Glow */
    --sp-color-ai-glow: rgba(124, 93, 250, 0.4);
    --sp-color-ai-pulse: #00F5D4;
    --sp-ambient-primary: 124, 93, 250;
    --sp-ambient-secondary: 229, 9, 20;

    /* Status Colors */
    --sp-color-status-success: #10B981;
    --sp-color-status-warning: #F59E0B;
    --sp-color-status-error: #EF4444;
    --sp-color-status-info: #3B82F6;
    --sp-color-rating-star: #FFB800;

    /* Overlays & Cinematic Gradients */
    --sp-overlay-scrim-dark: rgba(7, 8, 10, 0.85);
    --sp-overlay-scrim-medium: rgba(7, 8, 10, 0.6);
    --sp-overlay-scrim-light: rgba(7, 8, 10, 0.3);
    --sp-overlay-hero-gradient: linear-gradient(180deg, rgba(7, 8, 10, 0) 0%, rgba(7, 8, 10, 0.7) 60%, #07080A 100%);
    --sp-overlay-glass: rgba(18, 21, 30, 0.75);

    /* Elevation & Soft Shadows */
    --sp-shadow-flat: 0 2px 8px rgba(0, 0, 0, 0.4);
    --sp-shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.6);
    --sp-shadow-modal: 0 20px 50px rgba(0, 0, 0, 0.85);
    --sp-shadow-glow-brand: 0 0 20px rgba(229, 9, 20, 0.4);
    --sp-shadow-glow-ambient: 0 0 30px rgba(124, 93, 250, 0.35);
    --sp-shadow-glow-ai-pulse: 0 0 25px rgba(0, 245, 212, 0.5);

    --sp-elevation-0: none;
    --sp-elevation-1: 0 1px 3px 1px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.30);
    --sp-elevation-2: 0 2px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.30);
    --sp-elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.30);
    --sp-elevation-4: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.30);

    /* ==========================================================================
     2. SHARED TYPOGRAPHY TOKENS
     ========================================================================== */
    --sp-font-display: 'Sora', 'Outfit', system-ui, -apple-system, sans-serif;
    --sp-font-body: 'Plus Jakarta Sans', 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
    --sp-font-mono: 'JetBrains Mono', monospace;

    --sp-font-weight-regular: 400;
    --sp-font-weight-medium: 500;
    --sp-font-weight-semibold: 600;
    --sp-font-weight-bold: 700;
    --sp-font-weight-extrabold: 800;

    --sp-font-display-hero: clamp(2.5rem, 5vw + 1rem, 4.5rem);
    --sp-font-display-h1: clamp(2rem, 3.5vw + 0.8rem, 3.2rem);
    --sp-font-display-h2: clamp(1.5rem, 2.5vw + 0.5rem, 2.2rem);
    --sp-font-heading-h3: clamp(1.25rem, 1.8vw + 0.4rem, 1.6rem);
    --sp-font-body-lg: 1.125rem;
    --sp-font-body-md: 1rem;
    --sp-font-body-sm: 0.875rem;
    --sp-font-caption: 0.75rem;
    --sp-font-micro: 0.6875rem;

    --sp-line-height-tight: 1.15;
    --sp-line-height-heading: 1.25;
    --sp-line-height-normal: 1.5;
    --sp-line-height-relaxed: 1.65;

    /* ==========================================================================
     3. SPATIAL & SPACING TOKENS (Material 3 Grid & Layout)
     ========================================================================== */
    --sp-space-0: 0px;
    --sp-space-1: 4px;
    --sp-space-2: 8px;
    --sp-space-3: 12px;
    --sp-space-4: 16px;
    --sp-space-5: 20px;
    --sp-space-6: 24px;
    --sp-space-8: 32px;
    --sp-space-10: 40px;
    --sp-space-12: 48px;
    --sp-space-16: 64px;
    --sp-space-20: 80px;
    --sp-space-24: 96px;

    --sp-radius-none: 0px;
    --sp-radius-xs: 4px;
    --sp-radius-sm: 6px;
    --sp-radius-md: 12px;
    --sp-radius-lg: 18px;
    --sp-radius-xl: 28px;
    --sp-radius-full: 9999px;

    /* Layout Constraints */
    --sp-container-max-width: 1440px;
    --sp-container-padding: 24px;
    --sp-container-padding-mobile: 16px;

    /* Z-Index Hierarchy */
    --sp-z-deep: -1;
    --sp-z-base: 0;
    --sp-z-docked: 10;
    --sp-z-sticky: 100;
    --sp-z-header: 500;
    --sp-z-overlay: 800;
    --sp-z-modal: 1000;
    --sp-z-toast: 1200;
    --sp-z-tooltip: 1400;

    /* ==========================================================================
     4. NEURAL MOTION & ANIMATION TOKENS
     ========================================================================== */
    --sp-motion-easing-neural: cubic-bezier(0.16, 1, 0.3, 1);
    --sp-motion-easing-cinematic: cubic-bezier(0.25, 0.1, 0.25, 1);
    --sp-motion-easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
    --sp-motion-easing-invisible: cubic-bezier(0.4, 0, 0.2, 1);

    --sp-motion-duration-fast: 150ms;
    --sp-motion-duration-medium: 250ms;
    --sp-motion-duration-slow: 400ms;
    --sp-motion-duration-cinematic: 800ms;

    --sp-transition-fast: var(--sp-motion-duration-fast) var(--sp-motion-easing-invisible);
    --sp-transition-normal: var(--sp-motion-duration-medium) var(--sp-motion-easing-invisible);
    --sp-transition-expressive: var(--sp-motion-duration-slow) var(--sp-motion-easing-neural);
}

// ==========================================
// SCSS Component Example (BEM Style & Mixins)
// ==========================================
@use '@/assets/styles/abstract/mixins' as *;

.card {
  @include surface('container');
  border-radius: var(--sp-radius-md, 12px);
  color: var(--sp-color-text-primary);
  transition: box-shadow var(--sp-transition-normal), border-color var(--sp-transition-normal);

  &__header {
    padding: var(--sp-space-4) var(--sp-space-5);
    border-bottom: 1px solid var(--sp-border-subtle);
    background-color: var(--sp-color-surface-container-high);
  }

  &__title {
    @include typography('h3');
    color: var(--sp-color-text-primary);
  }

  &__body {
    padding: var(--sp-space-5);
    @include typography('body-md');
    color: var(--sp-color-text-secondary);
  }

  &--interactive {
    @include interactive-surface;
    @include focus-ring;
  }
}
```

---

## **3. STANDARD FORMATTING (FULLSTACK JSDoc)**

Mọi file được tạo ra hoặc chỉnh sửa bắt buộc tuân thủ chuẩn JSDoc và cấu trúc sau:

### **3.1. File Header (Bắt buộc cho mọi file)**

```typescript
/**
 * @file [tên-file.ts / tên-file.scss]
 * @module [Tên_Module]
 * @description [Mô tả ngắn gọn chức năng của module/file]
 */
```

### **3.2. Frontend: React Component (Dumb UI)**

```typescript
/**
 * @component [ComponentName]
 * @description [Chức năng của component - Phản ánh đúng trạng thái AI/User]
 */
import React from 'react';
import './[component-name].scss';

interface [ComponentName]Props {
  // Ưu tiên truyền data và event handler từ parent/hook vào đây
  title: string;
  isActive?: boolean;
  onAction?: () => void;
}

const [ComponentName]: React.FC<[ComponentName]Props> = ({ title, isActive, onAction }) => {
  return (
    <div className={`[component-name] ${isActive ? '[component-name]--active' : ''}`}>
      <span className="[component-name]__title">{title}</span>
      {onAction && (
        <button type="button" className="[component-name]__button" onClick={onAction}>
          Thực hiện
        </button>
      )}
    </div>
  );
};

export default [ComponentName];
```

### **3.3. Frontend: Hooks & Stores**

```typescript
/**
 * @hook use[FeatureName]
 * @description Hook quản lý trạng thái và nghiệp vụ của [Tên Feature]
 * @returns {object} Trạng thái (state) và các hàm điều khiển (handlers)
 */
export const use[FeatureName] = () => {
  // Logic hooks, calls API via services
};
```

### **3.4. Backend: Controller (Express)**

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * @controller [Tên Controller]
 * @description [Mô tả chức năng controller]
 * @route [METHOD] /api/[path]
 */
export const [functionName] = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log(`[Ctrl][Module] [METHOD] /api/[path]`);
    // CHỈ parse Request, validate params & gọi Service. KHÔNG chứa logic nghiệp vụ nặng.
    const result = await [serviceFunction](req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error); // Chuyển toàn bộ Error về Centralized Error Middleware xử lý
  }
};
```

---

## **4. KIẾN TRÚC, FOLDER STRUCTURE & NAMING CONVENTION**

Luôn tổ chức file đúng layer. Cấu trúc không gian làm việc và quy ước đặt tên (Naming Convention) được quy định nghiêm ngặt như sau:

### **Quy Ước Đặt Tên (Naming Convention)**

* **Backend:** Bắt buộc sử dụng `kebab-case` cho TOÀN BỘ thư mục và tên file (ví dụ: `auth.controller.ts`, `user-service.ts`, `auth-middleware.ts`).
* **Frontend:**
  * Thư mục, hooks, services, utils, store, constants, styles: Bắt buộc dùng `kebab-case` (ví dụ: `use-chat.ts`, `chat.service.ts`, `button.scss`).
  * **Ngoại lệ duy nhất:** File chứa React Component chính bắt buộc dùng `PascalCase` (ví dụ: `ChatWindow.tsx`, `UserCard.tsx`, `SectionCard.jsx`).

---

## **5. IMPORT CONVENTION**

Bắt buộc tuân thủ thứ tự import có phân tách rõ ràng (cách nhau 1 dòng trống):

1. **External libraries:** `react`, `express`, `axios`, `framer-motion`, v.v.
2. **Absolute internal modules:** `@/services`, `@/controllers`, `@/hooks`, v.v.
3. **Relative modules & styles:** `./[component-name].scss`, `../utils`, v.v.

```typescript
// 1. External libs
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 2. Absolute internal imports
import { useAuth } from '@/hooks/use-auth';
import { userService } from '@/services/user.service';

// 3. Relative imports & Styles
import { formatUserName } from '../utils/format';
import './user-profile.scss';
```

---

## **6. NGUYÊN TẮC CỨNG (HARD RULES - DO NOT VIOLATE)**

### **Nguyên tắc Tư duy & Hệ thống**

1. **Tuân thủ Tuyệt đối Naming Convention:** Backend dùng 100% `kebab-case`. Frontend dùng `kebab-case` cho mọi thứ ngoại trừ React Component File (`PascalCase`).
2. **Chất lượng Thẩm mỹ (No Junk UI):** Không dùng màu neon vô tội vạ. Không lạm dụng bóng đổ đè lớp lộn xộn. Không nhồi nhét thông tin (luôn đảm bảo khoảng thở thông qua spacing tokens `--sp-space-*`).
3. **Di chuyển file = Auto Refactor:** Khi đổi tên hoặc di chuyển vị trí file, phải tự động cập nhật 100% các câu lệnh import liên quan trên toàn project.
4. **No Garbage Logs:** Xóa sạch comment sinh tự động vô nghĩa và các lệnh `console.log` rác; chỉ giữ lại log hệ thống có gắn tag chuẩn định danh (ví dụ: `[API][User]`, `[Socket][Stream]`).

### **Frontend Rules**

5. **NO TAILWIND, NO INLINE STYLES & NO CSS MODULES:** Bắt buộc dùng file `*.scss` (`kebab-case`) cho component-level và global styling (tuân thủ chuẩn BEM). Mọi biến đổi trạng thái UI phức tạp phải quy về CSS Variables `--sp-*` và mixins có sẵn trong `@styles/abstract/mixins`.
6. **UI Câm (Dumb UI):** Component UI chỉ chịu trách nhiệm render trạng thái và cảm xúc chuyển động (Neural Expressive). Không trực tiếp gọi API, không tính toán logic nghiệp vụ phức tạp bên trong component React. Toàn bộ logic phải tách vào Hooks/Services.

### **Backend Rules**

7. **Controller Câm, Service Thông Minh:** Controller chỉ làm trạm tiếp nhận Request -> chuyển sang Service xử lý -> trả Response. Nghiệp vụ `if/else`, validate chuyên sâu, truy vấn cơ sở dữ liệu phải nằm hoàn toàn trong Service.
8. **Tách biệt Data Transfer:** Service Frontend (gọi Axios) và Service Backend (truy vấn DB) cần được định nghĩa rõ ràng theo từng layer, kèm chú thích JSDoc đầy đủ để tránh nhầm lẫn.
9. **Bắt lỗi tập trung (Centralized Error Handling):** Mọi ngoại lệ Backend phải được chuyển tiếp qua `next(error)` hoặc ném về Error Middleware tập trung. Tuyệt đối không rải `res.status(500)` tự do trong controllers.
