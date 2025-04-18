# Hoarding App

A React Native mobile application for managing outdoor advertising hoardings with location-based features.

## Features

- User Authentication (Login/Register)
- Add Hoardings with Location
- View Hoardings on Map
- Search Nearby Hoardings
- Real-time Location Updates
- Interactive Map Interface

## Tech Stack

- **Frontend:**
  - React Native
  - Expo
  - React Navigation
  - React Native Maps
  - Axios
  - AsyncStorage

- **Backend:**
  - Node.js
  - Express
  - MongoDB
  - Mongoose
  - JWT Authentication
  - GeoJSON

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Expo CLI
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/hoarding-app.git
   cd hoarding-app
   ```

2. Install dependencies:
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install
   ```

3. Environment Setup:
   - Create a `.env` file in the backend directory:
     ```
     MONGODB_URI=your_mongodb_connection_string
     JWT_SECRET=your_jwt_secret
     PORT=5000
     ```

4. Start the servers:
   ```bash
   # Start backend server
   cd backend
   npm run dev

   # In a new terminal, start frontend
   cd ..
   npx expo start
   ```

5. Use the Expo Go app to scan the QR code and run the app on your device.

## Project Structure

```
hoarding-app/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── server.js
├── screens/
├── components/
├── services/
├── navigation/
└── App.js
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Hoardings
- `POST /api/hoardings/add` - Add new hoarding
- `GET /api/hoardings/nearby` - Get nearby hoardings
- `GET /api/hoardings` - Get all hoardings

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 