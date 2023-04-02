# functional-templates [![test](https://github.com/WiseLibs/functional-templates/actions/workflows/test.yml/badge.svg)](https://github.com/WiseLibs/functional-templates/actions/workflows/test.yml)

`functional-templates` is an HTML/XML templating language based on functional programming principles. On the surface, it looks like [`mustache`](https://mustache.github.io/) or [`handlebars`](https://handlebarsjs.com/guide/#what-is-handlebars), but it's actually much more powerful.

In most other templating languages, each template needs to be given data that was specifically constructed just for that template, and the only way to know what data the template needs is by searching through every expression within the entire template (and all included templates). Instead, `functional-templates` explicitly declare all data that they use, and are capable of invoking async functions to pull in the relevant data inside the template itself.

> Over time, this allows you to build up a suite of reusable data-fetching functions (e.g., executing an SQL query), which new templates can instantly reuse without needing any special wiring outside the template file.

#### Lowest possible latency

`functional-templates` compile into [async generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) which output HTML/XML as soon as possible, without waiting for the entire template to finish executing. This can drastically reduce the time that it takes for your page to load.

For example, if your HTML page's `<head>` section contains scripts and stylesheets, but the `<body>` section contains data from your SQL database, `functional-templates` will output the `<head>` section while it's waiting for your SQL database to respond. Most modern browsers will start parsing your HTML page without waiting for the entire page to download, which means the browser can start requesting scripts and stylesheets before the entire HTML page has even been constructed on your server. You can further improve performance by [preloading](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload) images and videos.

Furthermore, `functional-templates` analyzes the expressions within your templates, and automatically computes the dependencies between each expression. For example, if one expression declares a variable `userId`, and another expression references `userId`, we know that the second expression depends on the first one (the actual computation is a bit more complicated, but this illustrates the basic idea). Using this analysis, `functional-templates` is able to figure out the most optimal way of executing each expression. For example, if you invoke three async functions that each pull in data from a database, but all three calls are independent, `functional-templates` will invoke them all in parallel, reducing round-trip latency. Conversely, if each call depends on the result of the previous call, `functional-templates` will invoke them serially. For any template, `functional-templates` is capable of automatically computing the most optimal way to fetch your data, so you don't need to manually code it yourself.

#### Restrictions

For everything described in the previous section to work properly, expressions within your template must not cause any observable side-effects. For example, a template expression should not mutate data used in other parts of the template. For virtually all [`mustache`](https://mustache.github.io/)/[`handlebars`](https://handlebarsjs.com/guide/#what-is-handlebars) templates in the world, this is already the case. Note that you can still do things such as logging and event reporting, which don't effect the template's output.

## Installation

```
npm install functional-templates
```

> Requires Node.js v14.x.x or later.

## Usage

```js
const FT = require('functional-templates');

const helpers = {
    getName() {
        return 'Josh';
    },
};

// The compiledTemplate is a string, which can be cached offline.
const compiledTemplate = await FT.compile('./template.html');

const template = FT.create(compiledTemplate, helpers);

for await (const string of template()) {
    process.stdout.write(string);
}
```

##### template.html

```
<html>
    <head>
        <title>Welcome to my site!</title>
    </head>
    <body>
        My name is {{getName()}}.
    </body>
</html>
```

### Server example

```js
const http = require('http');
const stream = require('stream');
const FT = require('functional-templates');

const compiledTemplate = await FT.compile('./template.html');
const template = FT.create(compiledTemplate);

const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    stream.Readable.from(template(), { objectMode: false }).pipe(res);
});

server.listen(80);
```

## Documentation

- [Language guide](./docs/lang.md)
- [API documentation](./docs/api.md)

## License

[MIT](./LICENSE)
