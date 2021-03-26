const User = require("../models/User");

const isAuthenticated = async (req, res, next) => {
  try {
    if (req.headers.authorization) {
      // Collect the token
      const token = req.headers.authorization.replace("Bearer ", "");

      // Search the database
      const user = await User.findOne({ token: token }).select(
        "account email token"
      );

      if (user) {
        // Add a user key to the req object
        req.user = user;

        return next();
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = isAuthenticated;
