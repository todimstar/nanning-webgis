CREATE DATABASE IF NOT EXISTS nanning_webgis
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE nanning_webgis;

CREATE TABLE IF NOT EXISTS evaluation_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  profile_key VARCHAR(64) NOT NULL,
  lon DECIMAL(10, 6) NOT NULL,
  lat DECIMAL(10, 6) NOT NULL,
  score DECIMAL(5, 2) NULL,
  level_label VARCHAR(64) NULL,
  environment_json JSON NULL,
  assessment_json JSON NULL,
  location_context_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_evaluation_profile_time (profile_key, created_at),
  INDEX idx_evaluation_location (lon, lat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_explanation_cache (
  cache_key CHAR(64) NOT NULL PRIMARY KEY,
  provider VARCHAR(64) NOT NULL,
  model VARCHAR(128) NULL,
  explanation_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_exports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  profile_key VARCHAR(64) NOT NULL,
  lon DECIMAL(10, 6) NOT NULL,
  lat DECIMAL(10, 6) NOT NULL,
  html MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_profile_time (profile_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key CHAR(64) NOT NULL PRIMARY KEY,
  provider VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
