"""
Authentication and authorization module
Handles JWT tokens, password hashing, and role-based access control
"""
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
import bcrypt
import os
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from api.database import get_db, User, Role, Permission

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")  # Change this in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Encode password to bytes if it's a string
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Encode password to bytes if it's a string
    if isinstance(password, str):
        password = password.encode('utf-8')
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password, salt)
    # Return as string
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate a user by username and password"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user (alias for get_current_user)"""
    return current_user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None (for optional auth)"""
    try:
        # Try to get token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return None

        token = authorization.split(" ")[1]
        if not token:
            return None

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = db.query(User).filter(User.username == username).first()
        if user is None or not user.is_active:
            return None
        return user
    except (JWTError, HTTPException, KeyError, IndexError):
        return None


def require_permission(permission_name: str):
    """Dependency to require a specific permission"""
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Superusers have all permissions
        if current_user.is_superuser:
            return current_user

        # Check if user has the required permission through roles
        user_permissions = set()
        for role in current_user.roles:
            if role.is_active:
                for perm in role.permissions:
                    user_permissions.add(perm.name)

        if permission_name not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_name}' required"
            )
        return current_user

    return permission_checker


def require_role(role_name: str):
    """Dependency to require a specific role"""
    def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Superusers have all roles
        if current_user.is_superuser:
            return current_user

        role_names = {role.name for role in current_user.roles if role.is_active}
        if role_name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' required"
            )
        return current_user

    return role_checker


def get_user_permissions(user: User, db: Session) -> List[str]:
    """Get all permissions for a user"""
    if user.is_superuser:
        # Superusers have all permissions
        all_perms = db.query(Permission).all()
        return [perm.name for perm in all_perms]

    permissions = set()
    for role in user.roles:
        if role.is_active:
            for perm in role.permissions:
                permissions.add(perm.name)
    return list(permissions)


def init_default_roles_and_permissions(db: Session):
    """Initialize default roles and permissions"""
    # Default permissions
    permissions = [
        {"name": "analysis:read", "description": "View analyses", "resource": "analysis", "action": "read"},
        {"name": "analysis:write", "description": "Create analyses", "resource": "analysis", "action": "write"},
        {"name": "analysis:delete", "description": "Delete analyses", "resource": "analysis", "action": "delete"},
        {"name": "user:read", "description": "View users", "resource": "user", "action": "read"},
        {"name": "user:write", "description": "Create/edit users", "resource": "user", "action": "write"},
        {"name": "user:delete", "description": "Delete users", "resource": "user", "action": "delete"},
        {"name": "compliance:read", "description": "View compliance rules", "resource": "compliance", "action": "read"},
        {"name": "compliance:write", "description": "Create/edit compliance rules", "resource": "compliance", "action": "write"},
        {"name": "compliance:delete", "description": "Delete compliance rules", "resource": "compliance", "action": "delete"},
        {"name": "admin:all", "description": "Full admin access", "resource": "admin", "action": "all"},
    ]

    for perm_data in permissions:
        perm = db.query(Permission).filter(Permission.name == perm_data["name"]).first()
        if not perm:
            perm = Permission(**perm_data)
            db.add(perm)

    db.commit()

    # Default roles
    roles = [
        {
            "name": "admin",
            "description": "Administrator with full access",
            "permissions": ["analysis:read", "analysis:write", "analysis:delete", "user:read", "user:write", "user:delete", "compliance:read", "compliance:write", "compliance:delete", "admin:all"]
        },
        {
            "name": "analyst",
            "description": "Can view and create analyses",
            "permissions": ["analysis:read", "analysis:write", "compliance:read"]
        },
        {
            "name": "viewer",
            "description": "Can only view analyses",
            "permissions": ["analysis:read", "compliance:read"]
        },
    ]

    for role_data in roles:
        role = db.query(Role).filter(Role.name == role_data["name"]).first()
        if not role:
            role = Role(
                name=role_data["name"],
                description=role_data["description"]
            )
            db.add(role)
            db.flush()

            # Assign permissions
            for perm_name in role_data["permissions"]:
                perm = db.query(Permission).filter(Permission.name == perm_name).first()
                if perm:
                    role.permissions.append(perm)

        db.commit()

