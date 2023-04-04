# Language guide

##### Introduction

A "template" is a text file (usually HTML, XML, or Markdown), with embedded *template expressions*. A template expression is a `{{`, some contents, followed by a `}}`. When a template is executed, these expressions are replaced with content depending on the expression.

##### Basic features:

- [Simple expressions](#simple-expressions)
- ["let" blocks](#let-blocks)
- ["if" blocks](#if-blocks)
- ["each" blocks](#each-blocks)
- [Comments](#comments)

##### Template composition (partials):

- [Included templates](#included-templates)
- [Template parameters](#template-parameters)
- [Template slots and sections](#template-slots-and-sections)

##### Advanced features:

- [Effects](#effects)
- [Raw expressions](#raw-expressions)
- ["transform" blocks](#transform-blocks)

## Simple expressions

Simple expressions will print the result of the embedded JavaScript expression.

```
<p>Here is a random number: {{Math.random()}}</p>
```

The JavaScript must evaluate to a string, number, or [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt). If it evaluates to anything else, or if it evaluates to [`NaN`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN), an error will be thrown.

### Asynchronous expressions

Any embedded JavaScript expression can evaluate to a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), which means you can call async functions from within templates. You can even use `await` syntax within any embedded JavaScript expression.

```
<p>{{(await getAlertMessage()).toUpperCase()}}</p>
```

## "let" blocks

A "let" block allows you to declare a variable within a template. The variable will be accessible from any expression inside the block.

```
{{let user: getUserData()}}
    <p>Welcome, {{user.name}}!</p>
{{end}}
```

For convenience, "let" blocks don't need an `{{end}}` token if they're declared at the top of the file.

```
{{let user: getUserData()}}
{{let comments: getComments(user.id)}}

<div>
    <p>Here is the user's most recent comment:</p>
    <blockquote>{{comments[0]}}</blockquote>
</div>
```

Like all other expressions, the variable assignment can evaluate to a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). However, when referenced by other expressions, the variable will be a regular value (not a promise), so you don't need to manually `await` it.

## "if" blocks

An "if" block allows you to conditionally execute part of a template, depending on some condition.

```
{{if payment.isOverdue()}}
    <p>Your payment is overdue! Please submit your payment today.</p>
{{end}}
```

If you specify an `{{else}}` clause, it will be executed when the condition is [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy).

```
{{if user.age >= 21}}
    <p>Here is our wine selection:</p>
{{else}}
    <p>You are too young to purchase wine.</p>
{{end}}
```

You can use "else if" chains, just like in regular programming languages.

```
{{if user.age >= 21}}
    <p>Here are our wine and cigarette selections:</p>
{{else if user.age >= 18}}
    <p>Here is our cigarette selection:</p>
{{else}}
    <p>You are too young to purchase wine or cigarettes.</p>
{{end}}
```

## "each" blocks

An "each" block allows you to loop over part of a template, executing it once for each item in an [iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) or [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) object.

```
<ul>
    {{each friend: user.getFriends()}}
        <li>
            {{friend.name}} is a friend of yours.
        </li>
    {{end}}
</ul>
```

If you specify an `{{else}}` clause, it will be executed when the given iterable is empty.

```
{{each item: shop.getInventory()}}
    <p>
        {{item.name}}: {{item.description}}
    </p>
{{else}}
    <p>
        All merchandise is sold-out.
    </p>
{{end}}
```

You can also get the index of the current iteration (starting at `0`) by declaring a second variable.

```
<ul>
    {{each day, index: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}}
        <li>
            {{day}}
            {{if index === 0}}
                (this is the first day of the week)
            {{end}}
        </li>
    {{end}}
</ul>
```

## Comments

You can use comments in your templates just as you would in your other code. Comments have no effect, and will not appear in the output. If you want a comment to appear in the output, just use an HTML comment.

```
{{! This comment will not show up in the output }}
{{!-- This comment may contain braces like }} --}}
<!-- This comment WILL show up in the output -->
```

Comments can be nested.

## Included templates

Templates can be "included" within other templates, making them highly reusable.

```
<html>
    <head>
        {{> "./head.html"}}
    </head>
    <body>
        {{> "./body.html"}}
    </body>
</html>
```

### Template parameters

Templates can define *template parameters*, which are simply "let" blocks without an assigned value. When including such a template, you can provide values to these parameters to customize the behavior of the included template.

##### head.html

```
{{let title}}
{{let customStylesheet}}

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="{{customStylesheet}}">
    <script src="/app.js" defer>
    <title>{{title}}</title>
<head>
```

##### index.html

```
<html>
    {{> "./head.html"
        with title: 'Home Page'
        with customStylesheet: '/home.css'
    }}
    <body>
        Welcome to my site!
    </body>
</html>
```

### Template slots and sections

Templates can define `{{slot}}` expressions, which get filled in by the parent template. When doing so, the parent template uses an "include" block instead of the previous `{{> ...}}` syntax.

##### base.html

```
<html>
    <head>
        <title>My Site</title>
    </head>
    <body>
        {{slot}}
    </body>
</html>
```

##### index.html

```
{{include "./base.html"}}
    <h1>Welcome to my site!</h1>
    <p>I hope you enjoy your time here.</p>
{{end}}
```

The content within the "include" block will be inserted where the `{{slot}}` is in the included template.

> The syntax `{{> "foo.html"}}` is really just a shorthand for an empty "include" block (`{{include "foo.html"}}{{end}}`). Both syntaxes have the same behavior, and both support template parameters.

### Named slots and sections

Besides a simple `{{slot}}`, templates can define any number of *named slots*. Parent templates can fill in named slots by passing "section" blocks.

##### base.html

```
<html>
    <head>
        {{> "./head.html"}}
        {{slot head}}
    </head>
    <body>
        {{slot}}
    </body>
</html>
```

##### index.html

```
{{include "./base.html"}}
    {{section head}}
        <link rel="stylesheet" href="./custom-style.css">
    {{end}}
    <h1>Welcome to my site!</h1>
    <p>I hope you enjoy your time here.</p>
{{end}}
```

> Sections are always optional. If a section is not provided, the corresponding slot won't display anything.

Like "let" blocks, "include" blocks don't need an `{{end}}` token if they're declared at the top of the file. Here is an example of using all these features together:

```
{{let article: getLatestArticle()}}
{{include "./base.html" with title: "Latest Article"}}

{{section head}}
    <link rel="stylesheet" href="./latest-article-style.css">
{{end}}

<main>
    <h1>Breaking News:</h1>
    {{article}}
</main>
```

## Effects

Sometimes it can be useful to execute side-effects from a template, without actually affecting the output. For example, perhaps you want to write some logs. For this, you can use "effect" expressions.

```
{{let user: getUser()}}
{{effect console.log(`generating page for user ${user.id}`)}}
```

Effects always occur in the background, in parallel with the rest of the template execution. If an effect throws an error (or if it returns a rejected Promise), it will cause an [unhandledRejection](https://nodejs.org/api/process.html#event-unhandledrejection). You are responsible for catching and handling any errors that may occur within an effect.

## Raw expressions

When using normal expressions, the embedded content will automatically be HTML-escaped to prevent [cross-site scripting](https://en.wikipedia.org/wiki/Cross-site_scripting) attacks. However, sometimes you may need to inject raw HTML into your page, without escaping it. For these situations, you can use `UNSAFE_INJECT`. Note that you should only do this if the injected HTML is 100% trusted (i.e., it doesn't come from user-entered data in your database).

```
<p>This will be bold: {{UNSAFE_INJECT '<b>hello!</b>'}}</p>
```

## "transform" blocks

A "transform" block allows you to transform part of a template through an arbitrary JavaScript expression. For example, you could transform Markdown into HTML. The content of a "transform" block is available via the special variable `__block`.

```
{{transform convertMarkdownToHTML(__block)}}
    # Navigation

    {{each item of navigationItems}}
        - [{{item.title}}]({{item.url}})
    {{end}}

    ## {{pageTitle}}

    {{pageContent}}
{{end}}
```

This can be a very powerful feature, but there are some downsides to be aware of. Firstly, all output within the "transform" block gets buffered, so that it can be transformed as a single string. This can eliminate the performance benefits of streaming, especially if applied to large parts of the page. Secondly, the output of a "transform" block is not HTML-escaped, so you must make sure that the transformation expression doesn't inject any untrusted content (or else you risk a [cross-site scripting](https://en.wikipedia.org/wiki/Cross-site_scripting) attack). However, any expressions *within* the "transform" block will still be HTML-escaped as normal.

The content within `__block` will not be indented, even if the "transform" block itself is indented.
