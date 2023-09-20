
(async () => {
  const {server} = await import('./appserver');
  const port = process.env.PORT ?? 8080;
  server
    .listen(port, () => {
      console.log(`Listening on port ${port}`);
    })
    .setTimeout(0); // Disable automatic timeout on incoming connections.
})();