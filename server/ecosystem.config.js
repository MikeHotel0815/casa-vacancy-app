module.exports = {
  apps : [{
    name   : "my-app-server",
    script : "index.js",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    }
  }]
};
