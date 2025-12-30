// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
};

// Check if user is authenticated (both admin and sales can access)
const isAuthenticated = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'sales')) {
    next();
  } else {
    res.status(403).json({ 
      message: 'Access denied. Authentication required.' 
    });
  }
};

module.exports = { isAdmin, isAuthenticated };
