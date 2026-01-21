# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-01-21

### Added
- Tooltip on label values showing voter's name (hover to see "value by username")

### Fixed
- Label values now display actual vote values from Gerrit API (previously showed +1/+2 only)
  - Uses LABELS and SUBMIT_REQUIREMENTS to fetch actual vote values from the `all` array
  - Supports labels with any scale (e.g., -3..+3, asymmetric -1..+2, etc.)

## [1.3.0] - 2026-01-08

### Added
- Comprehensive "Getting Started" guide in README with step-by-step installation
- Detailed instructions on where to find Gerrit HTTP credentials and password generation

### Changed
- Enhanced settings descriptions for clarity and user guidance

## [1.2.0] - 2026-01-07

### Changed
- Improved responsive layout for resizable split-view panels
  - Widget adapts to multiple container widths with smooth transitions
  - Subject column prioritized as most important content (commit message titles <78 chars)
  - Branch column hides at ~450px width (less important than Subject)
  - Project column hides at very narrow widths (~320px)
  - Column widths scale dynamically: wider in full view, narrower in split view
  - Eliminated horizontal scrollbars across all panel sizes
  - Fixed table layout prevents overflow issues

### Added
- `.env.example` file for development environment configuration
- Documentation for verifying frontend changes using browser automation tools

## [1.1.0] - 2026-01-05

### Added
- Gerrit-style colored background badges for label values (CR, V, CS)
  - Green backgrounds for positive scores (+1, +2)
  - Red backgrounds for negative scores (-1, -2)
- Screenshot automation script (`npm run screenshot`) using Puppeteer
- CHANGELOG.md for tracking version history

### Changed
- Label values now displayed as inline badges with rounded corners
- Improved visual spacing between label columns

## [1.0.0] - 2026-01-05

### Added
- Initial release of YouTrack Gerrit Plugin
- Widget displaying Gerrit changes in issue view (ISSUE_ABOVE_ACTIVITY_STREAM)
- Compact table view with Status, Subject, Project, Branch, and label columns
- Status indicators: ✓ Merged, ○ Open, ◐ WIP, ✗ Abandoned
- Support for Code-Review (CR), Verified (V), and custom label columns
- WIP (Work in Progress) status detection from Gerrit
- Configurable Gerrit connection settings:
  - Gerrit URL
  - Username and HTTP password authentication
  - Custom search query pattern with ${issue} placeholder
- Open/Closed change grouping
- Direct links to Gerrit changes
- Custom app icon inspired by Gerrit logo
- README with installation and configuration instructions

### Security
- HTTP password stored securely using YouTrack's secret field type

[Unreleased]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/phoenix-rtos/youtrack-gerrit-plugin/releases/tag/v1.0.0
