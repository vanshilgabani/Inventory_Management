// middleware/isDeveloper.js
const DEVELOPER_ID = '69baa77ed43ec29b9968354b';

const isDeveloper = (req, res, next) => {
  if (req.user.id.toString() !== DEVELOPER_ID) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
};

module.exports = isDeveloper;
