# YummyDoors Mobile Authentication Implementation Guide

This document outlines the complete architectural pattern and step-by-step guide to implementing a robust, production-ready authentication system in the `yummydoors_mobile` Flutter application. It leverages best practices used in the `yummy` POS application, utilizing **Dio** for networking, **Bloc/Cubit** for state management, and the existing `yummydoors_backend` API.

---

## 1. Backend Authentication APIs Reference

The `yummydoors_backend` exposes the following endpoints under the `/auth` prefix. These are exactly what the mobile app will interact with:

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/login` | POST | Authenticate user. Returns `access_token` and `refresh_token`. |
| `/auth/register` | POST | Register a new user account. |
| `/auth/google` | POST | OAuth login via Google token. |
| `/auth/refresh` | POST | Refresh expired access token using the refresh token. |
| `/auth/logout` | POST | Invalidate session (requires refresh token in payload). |
| `/auth/me` | GET | Fetch the current user's profile summary (requires access token). |
| `/auth/change-password` | POST | Update password for authenticated users. |
| `/auth/password-reset/request` | POST | Request a password reset link (via email/phone). |
| `/auth/password-reset/confirm` | POST | Confirm password reset with a valid token. |

*Note: All endpoints return a standard `ApiResponse` structure containing `message` and `data`.*

---

## 2. Recommended Package Dependencies

Add the following to your `pubspec.yaml` in `yummydoors_mobile`:

```yaml
dependencies:
  flutter_bloc: ^8.1.3    # State management
  dio: ^5.4.0             # Networking
  shared_preferences: ^2.2.2 # Local session storage (or flutter_secure_storage for extra security)
  equatable: ^2.0.5       # Value equality for Bloc states
  get_it: ^7.6.4          # Dependency injection (Service Locator)
```

---

## 3. Architecture & Folder Structure

Following clean architecture (similar to `yummy`), your auth feature should be structured like this inside `lib/features/auth/`:

```
lib/
  core/
    network/
      dio_client.dart            # Singleton Dio setup with base URLs
      auth_interceptor.dart      # Intercepts requests to inject tokens & handle 401s
    utils/
      secure_storage.dart        # Helper class for storing tokens
  features/
    auth/
      data/
        models/
          user_model.dart        # Data model mapped from /auth/me
        repositories/
          auth_repository.dart   # Handles Dio API calls for auth
      presentation/
        cubit/
          auth_cubit.dart        # Manages Global Auth State (Logged in / Logged out)
          auth_state.dart        # States: Initial, Loading, Authenticated, Unauthenticated, Error
          login_cubit.dart       # Manages Local Login Form State
        screens/
          login_screen.dart
          register_screen.dart
```

---

## 4. Implementation Steps

### Step 1: Secure Token Storage

Create a wrapper around `SharedPreferences` (or `flutter_secure_storage`) to safely read and write your JWT tokens.

```dart
class TokenStorage {
  static const String _accessTokenKey = 'ACCESS_TOKEN';
  static const String _refreshTokenKey = 'REFRESH_TOKEN';

  Future<void> saveTokens(String accessToken, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, accessToken);
    await prefs.setString(_refreshTokenKey, refreshToken);
  }

  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey);
  }
  
  Future<void> clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
  }
}
```

### Step 2: The Dio Auth Interceptor (CRITICAL)

This is the most important part of a robust mobile auth flow. The interceptor will automatically inject the `access_token` into the header of every API request. If the backend returns a `401 Unauthorized`, the interceptor should catch it, call `/auth/refresh` to get a new token, save it, and seamlessly retry the original failed request.

```dart
class AuthInterceptor extends Interceptor {
  final TokenStorage tokenStorage;
  final Dio dio; // A separate dio instance just for refreshing tokens to avoid infinite loops

  AuthInterceptor(this.tokenStorage, this.dio);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final accessToken = await tokenStorage.getAccessToken();
    if (accessToken != null) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // 1. Try to refresh the token
      bool refreshSuccess = await _refreshToken();
      
      if (refreshSuccess) {
        // 2. If successful, retry the original request with the new token
        final newAccessToken = await tokenStorage.getAccessToken();
        err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
        
        final response = await dio.fetch(err.requestOptions);
        return handler.resolve(response);
      } else {
        // 3. If refresh fails (e.g. refresh token expired), force logout
        // Dispatch an event to AuthCubit to log the user out
      }
    }
    return handler.next(err);
  }
}
```

### Step 3: Global AuthCubit (State Management)

The `AuthCubit` sits at the very top of your widget tree (above `MaterialApp`). It dictates whether the app shows the Login Screen or the Home Screen.

**States:**
* `AuthInitial` - App is checking if a token exists on startup (shows splash screen).
* `Authenticated(User)` - Token is valid, show Home.
* `Unauthenticated` - No valid token, show Login.

```dart
class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _authRepository;
  final TokenStorage _tokenStorage;

  AuthCubit(this._authRepository, this._tokenStorage) : super(AuthInitial());

  // Called when the app starts
  Future<void> checkAuthStatus() async {
    final token = await _tokenStorage.getAccessToken();
    if (token != null) {
      try {
        final user = await _authRepository.getMe();
        emit(Authenticated(user));
      } catch (e) {
        emit(Unauthenticated());
      }
    } else {
      emit(Unauthenticated());
    }
  }

  // Called after a successful login API call
  void loggedIn(User user) {
    emit(Authenticated(user));
  }

  // Called by the logout button or Interceptor when refresh fails
  Future<void> loggedOut() async {
    await _authRepository.logout();
    await _tokenStorage.clearTokens();
    emit(Unauthenticated());
  }
}
```

### Step 4: Routing based on State

In your `main.dart`, use a `BlocBuilder` to listen to the `AuthCubit` and direct the user seamlessly.

```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => GetIt.I<AuthCubit>()..checkAuthStatus(),
      child: MaterialApp(
        home: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            if (state is AuthInitial) {
              return SplashScreen(); // Loading indicator while checking storage
            } else if (state is Authenticated) {
              return HomeScreen(); // The main app
            } else {
              return LoginScreen(); // Auth wall
            }
          },
        ),
      ),
    );
  }
}
```

## Summary for Developers

1. Start by building the **TokenStorage** and setting up **Dio** with the **AuthInterceptor**.
2. Create the **AuthRepository** mapping all 9 backend endpoints via Dio.
3. Build the **AuthCubit** to manage the global session state.
4. Build localized Cubits (e.g., `LoginCubit`) specifically for handling the UI state of forms (loading spinners, error messages).
5. Wrap your app in a `BlocBuilder` to dynamically switch between Auth and Home flows.
