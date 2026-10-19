/**
 * @file index.js
 * @module Shared/Services
 * @description Điểm xuất tập trung cho toàn bộ hệ thống API CRUD Business Services.
 */

export { default as api, ApiError } from './api';
export { default as BaseService } from './base.service';
export { default as authService, AuthService } from './auth.service';
export { default as userService, UserService } from './user.service';
export { default as genreService, GenreService } from './genre.service';
export { default as countryService, CountryService } from './country.service';
export { default as categoryService, CategoryService } from './category.service';
export { default as actorService, ActorService } from './actor.service';
export { default as seriesService, SeriesService } from './series.service';
export { default as studioService, StudioService } from './studio.service';
export { default as movieService, MovieService } from './movie.service';
export { default as aiService, default as AiService } from './ai.service';
export { default as notificationService, NotificationService } from './notification.service';
export { default as uploadService, default as UploadService } from './upload.service';
export { default as securityService, SecurityService } from './security.service';
export { default as subscriptionService, SubscriptionService } from './subscription.service';
export { default as walletService, WalletService } from './wallet.service';
export { default as broadcastService, BroadcastService } from './broadcast.service';
