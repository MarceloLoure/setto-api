{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS (Dev)",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug", "--", "--inspect"],
      "autoAttachChildProcesses": true,
      "restart": true,
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to NestJS",
      "port": 9229,
      "restart": true
    }
  ]
}