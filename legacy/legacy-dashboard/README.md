# Email Bot Dashboard - Team Management System

A high-resolution modern SaaS dashboard for managing team-based email bot operations with React, Flask, and MongoDB.

## Features

### 🎨 Modern UI Design
- Dark blue collapsible sidebar with smooth transitions
- Light main content area with professional styling
- Responsive layout for mobile and desktop
- Rounded cards with soft shadows and hover effects
- Professional typography and color scheme

### 📊 Dashboard Components
- **Bot Control Panel**: Run/Pause/Stop buttons with status indicator
- **Live Statistics**: Real-time email sending metrics
- **Campaign Management**: Create and manage email campaigns
- **Draft Editor**: Rich text editor with attachment support
- **Analytics**: Charts showing email performance
- **Email Queue**: Monitor pending and sent emails
- **Logs Table**: Color-coded status tracking
- **Team Management**: Role-based access control

### 🔐 Authentication & Security
- JWT-based authentication
- Role-based permissions (Admin, Manager, Viewer)
- Secure API endpoints
- User profile management

### 📈 Analytics & Monitoring
- Line chart for emails sent per day
- Pie chart for success vs failed rates
- Bounce rate percentage display
- Daily limit progress bar
- Real-time sending speed metrics

### 🎯 Key Features
- **4K Resolution Ready**: High-DPI support for modern displays
- **Real-time Updates**: Live status changes without page refresh
- **Team Collaboration**: Multiple users with different permission levels
- **Campaign Templates**: Save and reuse email drafts
- **Configuration Options**: Custom send limits and delays
- **Export Functionality**: Download logs and analytics data

## Technology Stack

### Frontend
- **React 18**: Modern component-based architecture
- **Chart.js**: Interactive data visualization
- **CSS3**: Responsive design with animations
- **Font Awesome**: Professional icon library

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web framework for API routes
- **MongoDB**: NoSQL database for data storage
- **JWT**: Secure authentication tokens
- **Mongoose**: MongoDB object modeling

### Design System
- **Color Palette**: Professional blue (#1e3c72, #2a5298) with green accents (#4CAF50)
- **Typography**: System fonts for optimal readability
- **Spacing**: Consistent padding and margins
- **Interactions**: Smooth hover states and transitions

## Installation

### Prerequisites
- Node.js 14+ installed
- MongoDB Atlas cluster (or local MongoDB instance)
- Modern web browser with JavaScript enabled

### Setup Instructions

1. **Install Dependencies**
   ```bash
   cd dashboard
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB Atlas URI and JWT secret
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

5. **Access Dashboard**
   Open http://localhost:5000 in your browser
   
6. **Verify DB Connection**
   ```bash
   curl http://localhost:5000/api/health/db
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login with JWT token
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create new user (Admin only)

### Campaigns
- `GET /api/campaigns` - Get user's campaigns
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Email Operations
- `POST /api/send-emails` - Start email sending
- `GET /api/email-queue` - Get queued emails
- `POST /api/upload-contacts` - Upload contact list

### Analytics
- `GET /api/analytics` - Get sending statistics
- `GET /api/logs` - Get email logs
- `GET /api/performance` - Get performance metrics

## File Structure

```
dashboard/
├── public/
│   └── index.html          # Main React application
├── server.js               # Express.js backend server
├── package.json            # Node.js dependencies
├── .env                   # Environment variables
└── README.md               # This documentation
```

## Usage

### For Team Administrators
1. Set up user accounts with appropriate roles
2. Create and configure email campaigns
3. Monitor team performance through analytics
4. Manage sending limits and schedules

### For Team Members
1. Log in with provided credentials
2. Access assigned campaigns based on role
3. Monitor email sending progress
4. View performance analytics

### For Email Operations
1. Upload contact lists via the interface
2. Compose email drafts with rich text
3. Set sending parameters (limits, delays)
4. Monitor real-time sending progress
5. Analyze results through detailed logs

## Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Stateless session management
- **Role-Based Access**: Granular permission control
- **Input Validation**: Sanitized data processing
- **CORS Configuration**: Secure cross-origin requests

## Performance Optimizations

- **Lazy Loading**: Components load on demand
- **Caching Strategy**: Reduced database queries
- **Responsive Images**: Optimized for all screen sizes
- **Minified Assets**: Fast loading times

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile responsive design

---

**Email Bot Dashboard** - Professional team-based email automation management system built for modern businesses.
