module.exports = {
  apps: [
    {
      name: "baixe-web",
      cwd: "/home/user/htdocs/your-domain/quan-ly-bai-xe",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "baixe-worker",
      cwd: "/home/user/htdocs/your-domain/quan-ly-bai-xe",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "--env-file=.env src/workers/index.ts",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
