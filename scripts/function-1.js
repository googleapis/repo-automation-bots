exports["hello-World"] = (req, res) => {
    let message = req.query.message || req.body.message || 'Hello World!';
    res.status(200).send(message);
  };