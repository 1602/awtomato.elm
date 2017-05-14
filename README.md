## Usage

<small>dev bookmarklet source code:</small>

```
javascript:(function (src){ var d = window.document; d.head.appendChild(d.createElement('script')).src = src}('https://localhost:3000/index.js'));
```

prod bookmarklet:

```
javascript:(function (src){ var d = window.document; d.head.appendChild(d.createElement('script')).src = src}('https://1602.github.io/awtomato.elm/index.js'));
```
