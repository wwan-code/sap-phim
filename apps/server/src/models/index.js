/**
 * @file index.js
 * @module Models_Aggregator
 * @description Aggregator cho tất cả các models và thiết lập associations.
 */

import { sequelize } from '../config/database.config.js';
import Role from './role.model.js';
import User from './user.model.js';
import Wallet from './wallet.model.js';
import Series from './series.model.js';
import Category from './category.model.js';
import Genre from './genre.model.js';
import Country from './country.model.js';
import Studio from './studio.model.js';
import Movie from './movie.model.js';
import Episode from './episode.model.js';
import Actor from './actor.model.js';
import MovieActor from './movie-actor.model.js';
import Follower from './follower.model.js';
import Friendship from './friendship.model.js';
import AuditLog from './audit-log.model.js';
import AIAuditLog from './ai-audit-log.model.js';
import AIJob from './ai-job.model.js';
import UserSession from './user-session.model.js';
import Notification from "./notification.model.js";
import Permission from './permission.model.js';
import RolePermission from './role-permission.model.js';
import Subscription from './subscription.model.js';
import MembershipPlan from './membership-plan.model.js';
import PaymentRequest from './payment-request.model.js';
import WalletTransaction from './wallet-transaction.model.js';
import TrustedDevice from './trusted-device.model.js';
import PasswordHistory from './password-history.model.js';
import MfaCredential from './mfa-credential.model.js';
import Collection from "./collection.model.js";
import WatchHistory from "./watch-history.model.js";
import Watchlist from "./watchlist.model.js";
import Rating from "./rating.model.js";
import Comment from "./comment.model.js";
import BroadcastSchedule from "./broadcast-schedule.model.js";
import ReleaseRule from "./release-rule.model.js";
import BroadcastCalendar from "./broadcast-calendar.model.js";

// ──────────────────────────────────────────
//  ESTABLISH ASSOCIATIONS
// ──────────────────────────────────────────

// 1. Role <-> User (One-to-Many)
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Role <-> Permission
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions'
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles'
});

// Nhật ký kiểm toán hành động người dùng
User.hasMany(AuditLog, {
  foreignKey: "user_id",
  as: "auditLogs",
  onDelete: "SET NULL",
});
AuditLog.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Phiên đăng nhập người dùng (User Session)
User.hasMany(UserSession, {
  foreignKey: "user_id",
  as: "sessions",
  onDelete: "CASCADE",
});
UserSession.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// User <-> TrustedDevice (One-to-Many)
User.hasMany(TrustedDevice, { foreignKey: 'user_id', as: 'trustedDevices', onDelete: 'CASCADE' });
TrustedDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> PasswordHistory (One-to-Many)
User.hasMany(PasswordHistory, { foreignKey: 'user_id', as: 'passwordHistories', onDelete: 'CASCADE' });
PasswordHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> MfaCredential (One-to-Many)
User.hasMany(MfaCredential, { foreignKey: 'user_id', as: 'mfaCredentials', onDelete: 'CASCADE' });
MfaCredential.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 2. User <-> Wallet (One-to-One)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> Subscription
User.hasMany(Subscription, { foreignKey: 'user_id', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// MembershipPlan <-> Subscription
MembershipPlan.hasMany(Subscription, { foreignKey: 'plan_id', as: 'subscriptions' });
Subscription.belongsTo(MembershipPlan, { foreignKey: 'plan_id', as: 'plan' });

// Wallet <-> WalletTransaction
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// User <-> WalletTransaction
User.hasMany(WalletTransaction, { foreignKey: 'user_id', as: 'wallet_transactions' });
WalletTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> PaymentRequest
User.hasMany(PaymentRequest, { foreignKey: 'user_id', as: 'payment_requests' });
PaymentRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
PaymentRequest.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// MembershipPlan <-> PaymentRequest
MembershipPlan.hasMany(PaymentRequest, { foreignKey: 'plan_id', as: 'payment_requests' });
PaymentRequest.belongsTo(MembershipPlan, { foreignKey: 'plan_id', as: 'plan' });

// 3. Series <-> Movie (One-to-Many)
Series.hasMany(Movie, { foreignKey: 'series_id', as: 'movies', onDelete: 'SET NULL' });
Movie.belongsTo(Series, { foreignKey: 'series_id', as: 'series' });

// 4. Country <-> Movie (One-to-Many)
Country.hasMany(Movie, { foreignKey: 'country_id', as: 'movies' });
Movie.belongsTo(Country, { foreignKey: 'country_id', as: 'country' });

// 5. Category <-> Movie (One-to-Many)
Category.hasMany(Movie, { foreignKey: 'category_id', as: 'movies' });
Movie.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 6. Studio <-> Movie (One-to-Many)
Studio.hasMany(Movie, { foreignKey: 'studio_id', as: 'movies', onDelete: 'SET NULL' });
Movie.belongsTo(Studio, { foreignKey: 'studio_id', as: 'studio' });

// 7. Movie <-> Genre (Many-to-Many)
Movie.belongsToMany(Genre, {
  through: 'movie_genres',
  foreignKey: 'movie_id',
  otherKey: 'genre_id',
  as: 'genres',
  timestamps: false,
});
Genre.belongsToMany(Movie, {
  through: 'movie_genres',
  foreignKey: 'genre_id',
  otherKey: 'movie_id',
  as: 'movies',
  timestamps: false,
});

// 8. Movie <-> Episode (One-to-Many)
Movie.hasMany(Episode, { foreignKey: 'movie_id', as: 'episodes', onDelete: 'CASCADE' });
Episode.belongsTo(Movie, { foreignKey: 'movie_id', as: 'movie' });

// 8.1 Movie <-> BroadcastSchedule (One-to-One)
Movie.hasOne(BroadcastSchedule, { foreignKey: 'movie_id', as: 'broadcastSchedule', onDelete: 'CASCADE' });
BroadcastSchedule.belongsTo(Movie, { foreignKey: 'movie_id', as: 'movie' });

// 8.2 BroadcastSchedule <-> ReleaseRule (One-to-Many)
BroadcastSchedule.hasMany(ReleaseRule, { foreignKey: 'schedule_id', as: 'rules', onDelete: 'CASCADE' });
ReleaseRule.belongsTo(BroadcastSchedule, { foreignKey: 'schedule_id', as: 'schedule' });

// 8.3 BroadcastSchedule <-> BroadcastCalendar (One-to-Many)
BroadcastSchedule.hasMany(BroadcastCalendar, { foreignKey: 'schedule_id', as: 'calendars', onDelete: 'CASCADE' });
BroadcastCalendar.belongsTo(BroadcastSchedule, { foreignKey: 'schedule_id', as: 'schedule' });

// 8.4 BroadcastCalendar <-> Episode (One-to-One / Many-to-One)
Episode.hasMany(BroadcastCalendar, { foreignKey: 'episode_id', as: 'broadcastCalendars', onDelete: 'SET NULL' });
BroadcastCalendar.belongsTo(Episode, { foreignKey: 'episode_id', as: 'episode' });

// 8.5 ReleaseRule <-> BroadcastCalendar (One-to-Many)
ReleaseRule.hasMany(BroadcastCalendar, { foreignKey: 'rule_id', as: 'calendars', onDelete: 'SET NULL' });
BroadcastCalendar.belongsTo(ReleaseRule, { foreignKey: 'rule_id', as: 'rule' });

// 9. User (Creator) <-> Movie (One-to-Many)
User.hasMany(Movie, { foreignKey: 'created_by', as: 'created_movies' });
User.hasMany(Movie, { foreignKey: 'updated_by', as: 'updated_movies' });
Movie.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Movie.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// Content ownership and audit associations
User.hasMany(Actor, { foreignKey: 'created_by', as: 'created_actors' });
User.hasMany(Actor, { foreignKey: 'updated_by', as: 'updated_actors' });
Actor.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Actor.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

User.hasMany(Studio, { foreignKey: 'created_by', as: 'created_studios' });
User.hasMany(Studio, { foreignKey: 'updated_by', as: 'updated_studios' });
Studio.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Studio.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

User.hasMany(Series, { foreignKey: 'created_by', as: 'created_series' });
User.hasMany(Series, { foreignKey: 'updated_by', as: 'updated_series' });
Series.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Series.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// 10. Movie <-> Actor (Many-to-Many through MovieActor)
Movie.belongsToMany(Actor, {
  through: {
    model: MovieActor,
    attributes: [
      'id',
      'role',
      'role_name',
      'character_name',
      'character_image',
      'cast_order',
      'is_main_cast',
      'notes',
    ],
  },
  foreignKey: 'movie_id',
  otherKey: 'actor_id',
  as: 'actors',
});
Actor.belongsToMany(Movie, {
  through: {
    model: MovieActor,
    attributes: [
      'id',
      'role',
      'role_name',
      'character_name',
      'character_image',
      'cast_order',
      'is_main_cast',
      'notes',
    ],
  },
  foreignKey: 'actor_id',
  otherKey: 'movie_id',
  as: 'movies',
});

// Quan hệ trực tiếp giữa Actor và MovieActor (để lấy role dễ dàng hơn)
Movie.hasMany(MovieActor, { foreignKey: 'movie_id', as: 'movieActors' });
MovieActor.belongsTo(Movie, { foreignKey: 'movie_id', as: 'movie' });
Actor.hasMany(MovieActor, { foreignKey: 'actor_id', as: 'actorMovies' });
MovieActor.belongsTo(Actor, { foreignKey: 'actor_id', as: 'actor' });

// Lời mời đã gửi và đã nhận
User.hasMany(Friendship, {
  foreignKey: "requester_id",
  as: "sentFriendRequests",
  onDelete: "CASCADE",
});
Friendship.belongsTo(User, { foreignKey: "requester_id", as: "requester" });

User.hasMany(Friendship, {
  foreignKey: "addressee_id",
  as: "receivedFriendRequests",
  onDelete: "CASCADE",
});
Friendship.belongsTo(User, { foreignKey: "addressee_id", as: "addressee" });

// Chặn người dùng
User.hasMany(Friendship, { foreignKey: "blocker_id", as: "initiatedBlocks" });
Friendship.belongsTo(User, { foreignKey: "blocker_id", as: "blocker" });

// Danh sách bạn bè chấp thuận (2 chiều)
User.belongsToMany(User, {
  through: Friendship,
  foreignKey: "requester_id",
  otherKey: "addressee_id",
  as: "friendsAsRequester",
});
User.belongsToMany(User, {
  through: Friendship,
  foreignKey: "addressee_id",
  otherKey: "requester_id",
  as: "friendsAsAddressee",
});

// Quan hệ Bạn bè & Người theo dõi
User.belongsToMany(User, {
  through: Follower,
  as: "following",
  foreignKey: "follower_id",
  otherKey: "following_id",
});
User.belongsToMany(User, {
  through: Follower,
  as: "followers",
  foreignKey: "following_id",
  otherKey: "follower_id",
});

Follower.belongsTo(User, { foreignKey: "follower_id", as: "followerUser" });
Follower.belongsTo(User, { foreignKey: "following_id", as: "followingUser" });

User.hasMany(Notification, {
  foreignKey: "user_id",
  as: "notifications",
});
Notification.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
User.hasMany(Notification, {
  foreignKey: "actor_id",
  as: "triggeredNotifications",
});
Notification.belongsTo(User, {
  foreignKey: "actor_id",
  as: "actor",
});

// Watch History: tiến độ xem theo từng tập
User.hasMany(WatchHistory, {
  foreignKey: "user_id",
  as: "watchHistories",
  onDelete: "CASCADE",
});
WatchHistory.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
Movie.hasMany(WatchHistory, {
  foreignKey: "movie_id",
  as: "watchHistories",
  onDelete: "CASCADE",
});
WatchHistory.belongsTo(Movie, {
  foreignKey: "movie_id",
  as: "movie",
});
Episode.hasMany(WatchHistory, {
  foreignKey: "episode_id",
  as: "watchHistories",
  onDelete: "CASCADE",
});
WatchHistory.belongsTo(Episode, {
  foreignKey: "episode_id",
  as: "episode",
});

// Watchlist: danh sách anime cá nhân
User.hasMany(Watchlist, {
  foreignKey: "user_id",
  as: "watchlists",
  onDelete: "CASCADE",
});
Watchlist.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
Movie.hasMany(Watchlist, {
  foreignKey: "movie_id",
  as: "watchlists",
  onDelete: "CASCADE",
});
Watchlist.belongsTo(Movie, {
  foreignKey: "movie_id",
  as: "movie",
});

// Rating & Comment: phản hồi của người xem
User.hasMany(Rating, {
  foreignKey: "user_id",
  as: "ratings",
  onDelete: "CASCADE",
});
Rating.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
Movie.hasMany(Rating, {
  foreignKey: "movie_id",
  as: "ratings",
  onDelete: "CASCADE",
});
Rating.belongsTo(Movie, {
  foreignKey: "movie_id",
  as: "movie",
});
Episode.hasMany(Rating, {
  foreignKey: "episode_id",
  as: "ratings",
  onDelete: "CASCADE",
});
Rating.belongsTo(Episode, {
  foreignKey: "episode_id",
  as: "episode",
});

User.hasMany(Comment, {
  foreignKey: "user_id",
  as: "comments",
  onDelete: "CASCADE",
});
Comment.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
Movie.hasMany(Comment, {
  foreignKey: "movie_id",
  as: "comments",
  onDelete: "CASCADE",
});
Comment.belongsTo(Movie, {
  foreignKey: "movie_id",
  as: "movie",
});
Episode.hasMany(Comment, {
  foreignKey: "episode_id",
  as: "comments",
  onDelete: "CASCADE",
});
Comment.belongsTo(Episode, {
  foreignKey: "episode_id",
  as: "episode",
});
Comment.hasMany(Comment, {
  foreignKey: "parent_id",
  as: "replies",
  onDelete: "CASCADE",
});
Comment.belongsTo(Comment, {
  foreignKey: "parent_id",
  as: "parent",
});

// 23. User <-> AIAuditLog
User.hasMany(AIAuditLog, {
  foreignKey: "user_id",
  as: "ai_audit_logs",
  onDelete: "SET NULL",
});
AIAuditLog.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// ──────────────────────────────────────────
//  GLOBAL METADATA CACHE INVALIDATION HOOKS
// ──────────────────────────────────────────

const clearMetadataCache = async () => {
  try {
    const { cacheHelper } = await import('../config/redis.config.js');
    await cacheHelper.del("movies:metadata");
  } catch (err) {
    // Ignore potential errors during initialization or Redis failure
  }
};

[Genre, Category, Country, Studio, Actor, Series, Movie].forEach((model) => {
  model.addHook('afterSave', clearMetadataCache);
  model.addHook('afterDestroy', clearMetadataCache);
  model.addHook('afterBulkCreate', clearMetadataCache);
  model.addHook('afterBulkUpdate', clearMetadataCache);
  model.addHook('afterBulkDestroy', clearMetadataCache);
});

// ──────────────────────────────────────────
//  EXPORT
// ──────────────────────────────────────────

export {
  sequelize,
  Role,
  User,
  Wallet,
  Series,
  Category,
  Genre,
  Country,
  Studio,
  Movie,
  Episode,
  Actor,
  MovieActor,
  Follower,
  Friendship,
  AuditLog,
  AIAuditLog,
  AIJob,
  UserSession,
  Notification,
  Permission,
  RolePermission,
  Subscription,
  MembershipPlan,
  PaymentRequest,
  WalletTransaction,
  TrustedDevice,
  PasswordHistory,
  MfaCredential,
  Collection,
  WatchHistory,
  Watchlist,
  Rating,
  Comment,
  BroadcastSchedule,
  ReleaseRule,
  BroadcastCalendar
};

export default {
  sequelize,
  Role,
  User,
  Wallet,
  Series,
  Category,
  Genre,
  Country,
  Studio,
  Movie,
  Episode,
  Actor,
  MovieActor,
  Follower,
  Friendship,
  AuditLog,
  AIAuditLog,
  AIJob,
  UserSession,
  Notification,
  Permission,
  RolePermission,
  Subscription,
  MembershipPlan,
  PaymentRequest,
  WalletTransaction,
  TrustedDevice,
  PasswordHistory,
  MfaCredential,
  Collection,
  WatchHistory,
  Watchlist,
  Rating,
  Comment,
  BroadcastSchedule,
  ReleaseRule,
  BroadcastCalendar
};
