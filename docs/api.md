# API

- [function `compile`](#ftcompilefilename-options)
- [function `create`](#ftcreatecompiledtemplate-helpers)
- [function `escape`](#ftescapeinputstring)

## FT.compile(filename[, options])

- `filename` [&lt;string&gt;][string] The file path of the template to compile.
- `options` [&lt;Object&gt;][Object]
	- `resolve` [&lt;Function&gt;][Function] This option allows you to override how included template paths are interpretted. It should be a function that takes an include path (string) and returns the string which will be passed to `load()` (see below). The function's second argument will be the string that was used to load the current template file (where the include path was found).
	- `load` [&lt;Function&gt;][Function] This option allows you to override how template files are loaded. It should be an async function that takes a file path or URL (string) and returns the string contents of the file. By default, [`fs.readFile`](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options) is used.
	- `syncOnly` [&lt;boolean&gt;][boolean] If `true`, the compiled template will not support an asynchronous features, and it will return a string instead of an [async iterator]((https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols)). **Default:** `false`.
- Returns: [&lt;Promise][Promise][&lt;string&gt;][string][&gt;][Promise]

Compiles a template file, and returns the compiled template as a string.

Compiling templates can be a slow process, so it's recommended to cache compiled templates, rather than re-compiling them each time you need to execute them.

```js
const compiledTemplate = await FT.compile('./my-template.html');
```

#### An example of overriding the `resolve` and `load` functions

```js
const compiledTemplate = await FT.compile('http://example.com/template.html', {
    resolve(includeString, resolveFrom) {
        return new URL(includeString, resolveFrom).toString();
    },
    async load(url) {
        const response = await fetch(url);
        return response.text();
    },
});
```

## FT.create(compiledTemplate[, helpers])

- `compiledTemplate` [&lt;string&gt;][string] A compiled template string.
- `helpers` [&lt;Object&gt;][Object] An object whose key-value pairs will be accessible as variables in scope when the template executes. This is useful for providing reusable functions that can be used anywhere within the template.
- Returns: [&lt;Function&gt;][Function]

Creates an executable template function from a compiled template string. The template function returns an [async iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) which outputs strings as the template executes.

```js
const template = FT.create(compiledTemplate);

for await (const str of template()) {
    process.stdout.write(str);
}
```

If the `syncOnly` option was used when the template was compiled, the template function will instead return a string (the entire output), as shown below.

```js
const template = FT.create(compiledTemplate);

console.log(template());
```

#### Passing parameters to the template

If the template requires any [parameters](./lang.md#template-parameters), you can pass them as an object of key-value pairs to the template function.

```js
const template = FT.create(compiledTemplate);

const parameters = {
    name: 'Josh',
};

for await (const str of template(parameters)) {
    process.stdout.write(str);
}
```

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

## FT.escape(inputString)

- `inputString` [&lt;string&gt;][string] The string to HTML-escape.
- Returns: [&lt;string&gt;][string]

Transforms the given string so that HTML/XML special characters are escaped.



[any]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Data_types
[undefined]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#undefined_type
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#null_type
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object
[Function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
