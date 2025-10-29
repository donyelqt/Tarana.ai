# Referral Credit System Requirements

## Introduction

The Referral Credit System enables users to earn additional daily credits by inviting friends to join the Tarana AI platform. This system implements a tiered credit structure that rewards users based on their referral activity, encouraging organic growth while providing value to both referrers and new users.

## Glossary

- **Credit_System**: The core system that manages daily credit allocation, consumption, and refresh cycles
- **Referral_Engine**: The component responsible for tracking referral relationships and validating referral codes
- **Tier_Manager**: The service that calculates and assigns user tiers based on active referrals
- **Daily_Refresh_Service**: The automated service that resets credits at midnight Manila time
- **Active_Referral**: A referred user who has successfully signed up and remains active on the platform
- **Base_Credits**: The default 5 credits per day that all users receive
- **Bonus_Credits**: Additional credits earned through referrals based on tier level
- **Credit_Consumption**: The process of deducting credits when users access Tarana Gala or Tarana Eats
- **Referral_Code**: A unique alphanumeric identifier assigned to each user for tracking referrals
- **Supabase_Database**: The PostgreSQL database system used for data persistence

## Requirements

### Requirement 1: Base Credit Allocation

**User Story:** As a platform user, I want to receive 5 free credits daily, so that I can access Tarana services without any initial barriers.

#### Acceptance Criteria

1. THE Credit_System SHALL allocate 5 base credits to every registered user daily
2. WHEN a new user completes registration, THE Credit_System SHALL immediately grant 5 base credits
3. THE Credit_System SHALL refresh base credits at midnight Manila time regardless of user activity
4. THE Credit_System SHALL NOT carry over unused base credits to the next day
5. THE Credit_System SHALL maintain accurate credit balance tracking in the Supabase_Database

### Requirement 2: Referral Code Generation and Management

**User Story:** As a user, I want to have a unique referral code and link, so that I can invite friends and track my referrals.

#### Acceptance Criteria

1. WHEN a user registers, THE Referral_Engine SHALL generate a unique alphanumeric referral code
2. THE Referral_Engine SHALL ensure referral code uniqueness across all users
3. THE Referral_Engine SHALL create a shareable referral link containing the user's referral code
4. THE Referral_Engine SHALL store referral codes in the Supabase_Database with user associations
5. THE Referral_Engine SHALL provide copy-to-clipboard functionality for referral codes and links

### Requirement 3: Referral Registration Process

**User Story:** As a new user, I want to use a referral code during signup, so that I can receive bonus credits and help my friend earn rewards.

#### Acceptance Criteria

1. WHEN a new user provides a valid referral code during registration, THE Referral_Engine SHALL create a referral relationship
2. THE Referral_Engine SHALL grant 2 bonus daily credits to the new user upon successful referral registration
3. THE Referral_Engine SHALL validate referral codes against existing users in the Supabase_Database
4. IF an invalid referral code is provided, THEN THE Referral_Engine SHALL allow registration to continue without referral benefits
5. THE Referral_Engine SHALL record the referral timestamp and relationship in the Supabase_Database

### Requirement 4: Tiered Credit System Implementation

**User Story:** As a referring user, I want to earn more daily credits based on my successful referrals, so that I am incentivized to invite more friends.

#### Acceptance Criteria

1. THE Tier_Manager SHALL implement four distinct tiers: Default (5 credits), Explorer (6 credits), Smart Traveler (8 credits), and Voyager (10 credits)
2. WHEN a user has 1 active referral, THE Tier_Manager SHALL assign Explorer tier with 6 total daily credits
3. WHEN a user has 3 active referrals, THE Tier_Manager SHALL assign Smart Traveler tier with 8 total daily credits
4. WHEN a user has 5 or more active referrals, THE Tier_Manager SHALL assign Voyager tier with 10 total daily credits
5. THE Tier_Manager SHALL recalculate user tiers whenever referral counts change

### Requirement 5: Daily Credit Refresh Mechanism

**User Story:** As a user, I want my credits to refresh automatically at midnight, so that I have a fresh allocation each day.

#### Acceptance Criteria

1. THE Daily_Refresh_Service SHALL reset all user credits to their tier-appropriate amounts at midnight Manila time
2. THE Daily_Refresh_Service SHALL NOT preserve unused credits from the previous day
3. THE Daily_Refresh_Service SHALL update credit balances in the Supabase_Database atomically
4. THE Daily_Refresh_Service SHALL log refresh operations for audit purposes
5. IF the refresh service fails, THEN THE Credit_System SHALL implement retry mechanisms with exponential backoff

### Requirement 6: Credit Consumption for Services

**User Story:** As a user, I want to use my credits for Tarana Gala and Tarana Eats, so that I can access premium AI-powered recommendations.

#### Acceptance Criteria

1. WHEN a user accesses Tarana Gala, THE Credit_System SHALL deduct 1 credit from their balance
2. WHEN a user accesses Tarana Eats, THE Credit_System SHALL deduct 1 credit from their balance
3. IF a user has insufficient credits, THEN THE Credit_System SHALL prevent service access and display appropriate messaging
4. THE Credit_System SHALL update credit balances in real-time in the Supabase_Database
5. THE Credit_System SHALL provide accurate credit balance display in the user interface

### Requirement 7: Referral Activity Tracking

**User Story:** As a user, I want to see my referral activity and earned credits, so that I can track my progress and understand my benefits.

#### Acceptance Criteria

1. THE Referral_Engine SHALL display a list of successful referrals with timestamps
2. THE Referral_Engine SHALL show current tier status and progress toward next tier
3. THE Referral_Engine SHALL calculate and display total bonus credits earned through referrals
4. THE Referral_Engine SHALL provide referral statistics including total invites sent and conversion rates
5. THE Referral_Engine SHALL update activity displays in real-time when new referrals occur

### Requirement 8: Social Media Integration

**User Story:** As a user, I want to share my referral link on social media platforms, so that I can easily invite friends through multiple channels.

#### Acceptance Criteria

1. THE Referral_Engine SHALL provide direct sharing buttons for Facebook, Instagram, and LinkedIn
2. WHEN a user clicks a social sharing button, THE Referral_Engine SHALL open the appropriate platform with pre-populated referral message
3. THE Referral_Engine SHALL include the referral link in all social media shares
4. THE Referral_Engine SHALL track social media share events for analytics purposes
5. THE Referral_Engine SHALL handle platform-specific sharing limitations gracefully

### Requirement 9: Database Schema and Data Integrity

**User Story:** As a system administrator, I want reliable data storage and integrity, so that the referral system operates consistently and accurately.

#### Acceptance Criteria

1. THE Supabase_Database SHALL store user profiles with referral codes, current tier, and credit balances
2. THE Supabase_Database SHALL maintain referral relationships with referrer, referee, and timestamp data
3. THE Supabase_Database SHALL implement foreign key constraints to ensure referential integrity
4. THE Supabase_Database SHALL use appropriate indexes for efficient referral and credit queries
5. THE Supabase_Database SHALL implement row-level security policies for data protection

### Requirement 10: Error Handling and Recovery

**User Story:** As a user, I want the system to handle errors gracefully, so that temporary issues don't prevent me from using the referral system.

#### Acceptance Criteria

1. IF database operations fail, THEN THE Credit_System SHALL implement automatic retry mechanisms
2. THE Credit_System SHALL provide clear error messages when referral operations cannot be completed
3. THE Credit_System SHALL log all errors with sufficient detail for debugging and monitoring
4. THE Credit_System SHALL implement circuit breaker patterns for external service dependencies
5. THE Credit_System SHALL maintain system availability even during partial component failures