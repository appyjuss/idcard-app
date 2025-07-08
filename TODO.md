# Technical TODO List

## High Priority

### ID Card Generation Worker
- [ ] Implement actual ID card generation logic in worker.js: [Backend] [Core] [Image Processing]
  - Load template SVG/image from `jobRecord.server_template_path`
  - Load photo from `path.join(jobRecord.server_photos_unzip_path, cardRecord.photo_identifier)`
  - Use 'sharp' library to:
    - Resize/crop photo as needed
    - Composite photo onto template
    - Add text from cardRecord.card_data (name, title, etc.)
  - Save the output file with proper naming convention


### Error Handling & Recovery
- [ ] Implement more robust retry/reconnect strategy for Redis connection in production [Backend] [Infrastructure] [Reliability]
- [ ] Add job-level error recovery mechanisms for failed card generations [Backend] [Core] [Reliability]
- [ ] Implement cleanup strategy for failed jobs and their associated files [Backend] [Maintenance] [Storage]

## Medium Priority

### Database & Data Management
- [ ] Add database indexes for frequently queried columns [Database] [Performance]
- [ ] Implement data retention policy and cleanup jobs [Database] [Maintenance] [Storage]
- [ ] Add database backup strategy [Database] [Infrastructure] [Security]
- [ ] Consider implementing soft delete for jobs and cards [Database] [Core]
- [ ] Improve CSV photo identifier detection robustness [Database] [Core] [UX]
  - Allow users to specify photo identifier column name during upload
  - Consider implementing a fixed, documented column name (e.g., "photo_filename")
  - Enhance error messages to better guide users on column naming expectations

### Docker & Deployment
- [ ] Add a "wait-for-it" script to Docker setup to avoid race conditions between dependent services [DevOps] [Infrastructure] [Reliability]


### Security & Authentication
- [ ] Implement proper authentication middleware [Security] [Backend] [Core]
- [ ] Add rate limiting for API endpoints [Security] [Backend] [Performance]
- [ ] Implement file upload size limits and validation [Security] [Backend] [Storage]
- [ ] Add input sanitization for all user inputs [Security] [Backend] [Core]

### Performance & Scalability
- [ ] Implement caching strategy for frequently accessed data [Performance] [Backend] [Infrastructure]
- [ ] Add monitoring and logging infrastructure [Infrastructure] [Maintenance]
- [ ] Consider implementing horizontal scaling for worker processes [Infrastructure] [Scalability]
- [ ] Optimize file storage strategy for large uploads [Storage] [Performance]
- [ ] Optimize SVG processing by avoiding double parsing in idCardGenerator.js [Performance] [Backend] [Image Processing]
  - Consider refactoring processSvgWithEmbeddedImage to optionally return parsed doc object
  - This would eliminate the need to parse SVG twice for photo dimensions and processing
  - Example: processSvgWithEmbeddedImage could return { finalSvgString, parsedDoc }
- [ ] Implement streaming unzip for photo archives [Performance] [Backend] [Storage]
  - Replace current AdmZip implementation with streaming unzip
  - Process photos as they are extracted rather than waiting for full extraction
  - Add progress tracking for unzip operation
- [ ] Add pagination for card status retrieval [Performance] [Backend] [UX]
  - Implement cursor-based pagination for getJobStatus endpoint
  - Add query parameters for page size and cursor
  - Update frontend to handle paginated card status data
  - Consider implementing infinite scroll or "Load More" functionality

## Low Priority

### Code Quality & Maintenance
- [ ] Add comprehensive unit tests [Testing] [Quality]
- [ ] Add integration tests [Testing] [Quality]
- [ ] Implement CI/CD pipeline [DevOps] [Infrastructure]
- [ ] Add API documentation [Documentation] [Frontend] [Backend]
- [ ] Add code documentation [Documentation] [Quality]

### User Experience
- [ ] Add progress tracking for job status [Frontend] [UX]
- [ ] Implement better error messages for users [Frontend] [UX] [Backend]
- [ ] Add support for different template formats [Frontend] [Core] [Backend]
- [ ] Add preview functionality for generated cards [Frontend] [UX] [Image Processing]
- [ ] Improve photo status visibility in generated cards [Frontend] [UX] [Backend]
  - Add clear visual indicator when a card is generated without a photo
  - Include photo status in job completion report
  - Add photo status to card metadata/logs

### Infrastructure
- [ ] Set up proper staging environment [DevOps] [Infrastructure]
- [ ] Implement proper logging strategy [Infrastructure] [Maintenance]
- [ ] Add monitoring and alerting [Infrastructure] [Maintenance]
- [ ] Document deployment process [Documentation] [DevOps]

## Notes
- All sensitive information has been removed from this TODO list
- Tasks are organized by priority and component
- Each task should be reviewed for security implications before implementation

## Tags Legend
- [Backend] - Server-side implementation
- [Frontend] - Client-side implementation
- [Core] - Essential functionality
- [Infrastructure] - System architecture and deployment
- [Security] - Security-related features
- [Performance] - Performance optimization
- [Database] - Database-related tasks
- [Storage] - File storage and management
- [Testing] - Testing and quality assurance
- [Documentation] - Documentation tasks
- [UX] - User experience improvements
- [DevOps] - Development operations
- [Maintenance] - System maintenance
- [Reliability] - System reliability and stability
- [Scalability] - System scaling capabilities
- [Image Processing] - Image manipulation and processing
- [Quality] - Code quality improvements 

- [ ] Add a cron job or scheduled task to automatically delete expired jobs from the database


