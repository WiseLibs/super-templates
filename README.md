# super-templates [![test](https://github.com/WiseLibs/super-templates/actions/workflows/test.yml/badge.svg)](https://github.com/WiseLibs/super-templates/actions/workflows/test.yml)

`super-templates` is an HTML/XML templating language similar to [mustache](https://mustache.github.io/) and [handlebars](https://handlebarsjs.com/guide/#what-is-handlebars). It supports async functions and streaming, and is designed so that you don't need custom-formatted data for each template.

## Documentation

- [Language guide](./docs/lang.md)
- [API documentation](./docs/api.md)

## Installation

```
npm install super-templates
```

> Requires Node.js v14.x.x or later.

## Usage

```js
const ST = require('super-templates');

// The compiledTemplate is a string, which can be cached offline.
const compiledTemplate = await ST.compile('./template.html');

const template = ST.create(compiledTemplate);

for await (const string of template({ name: 'Josh' })) {
    process.stdout.write(string);
}
```

##### template.html

```
{{let name}}
<html>
    <head>
        <title>Welcome to my site!</title>
    </head>
    <body>
        My name is {{name}}.
    </body>
</html>
```

### Server example

```js
const http = require('http');
const stream = require('stream');
const ST = require('super-templates');

// First, compile the template.
const compiledTemplate = await ST.compile('./template.html');
const template = ST.create(compiledTemplate);

// Then, create the server.
const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
        // This server only supports GET requests.
        res.writeHead(405).end();
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });

    // Invoke the template, convert it to a Readable stream, and pipe it to the response.
    stream.Readable.from(template(), { objectMode: false }).pipe(res);
});

server.listen(80);
```

## Comparison with other templating languages

### Better readability

In most other templating languages, the only way to know what data the template needs is by searching through every expression within the entire template (and all included templates). With `super-templates`, all data is explicitly declared (typically at the top of the template file).

### Less "glue code"

In most other templating languages, each template is coupled to its own "data-fetching" function, which needs to format data specifically for that template. With `super-templates`, templates are capable of calling async functions to fetch data on their own, and they can use arbitrary JavaScript to format data as needed for display purposes.

### Lowest possible latency

In most other templating languages, you need to wait for all data to be fetched before you can render the template, and then you need to render the *entire* template before you can send it anywhere. With `super-templates`, rendering starts as soon as possible, even before any data has been fetched, and you can start streaming the output as soon as the first character is rendered.

For example, if your HTML page's `<head>` section contains scripts and stylesheets, but the `<body>` section contains data from your SQL database, `super-templates` will output the `<head>` section while it's waiting for your SQL database to respond. Most modern browsers will start parsing your HTML page without waiting for the entire page to download, which means the browser can start requesting scripts and stylesheets before the entire HTML page has even been constructed on your server. You can further improve performance by [preloading](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload) images and videos.

<details>
<summary>Click here for more details</summary>

With `super-templates`, templates compile into [async generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) which yield strings as soon as possible, without waiting for the entire template to finish executing. You can convert it into a stream by using [`Readable.from()`](https://nodejs.org/api/stream.html#streamreadablefromiterable-options).

Furthermore, when a template is compiled, all embedded expressions get analyzed, and each expression's dependencies are computed. For example, if one expression declares a variable `userId`, and another expression references `userId`, we know that the second expression depends on the first one (the actual computation is a bit more complicated, but this illustrates the basic idea). Using this analysis, `super-templates` is able to figure out the most optimal way of executing each expression. For example, if you invoke three async functions that each pull in data from a database, but all three calls are independent, `super-templates` will invoke them all in parallel, reducing round-trip latency. Conversely, if each call depends on the result of the previous call, `super-templates` will invoke them serially. For any template, `super-templates` is capable of automatically computing the most optimal way to fetch your data, so you don't need to manually code it yourself.
</details>

### Restrictions

With `super-templates`, expressions within your template must not cause any observable side-effects. This is required because `super-templates` tries to invoke everything is parallel (for better performance), which means the order of execution is not predictable. For example, a template expression should not mutate data used in other parts of the template, since the order of mutations is arbitrary. Note that you can still do things such as logging, which doesn't effect the template's output. Don't worry: if you've used templating languages like [mustache](https://mustache.github.io/) or [handlebars](https://handlebarsjs.com/guide/#what-is-handlebars), all of your templates already obey this restriction.

## License

[MIT](./LICENSE)
