## Usage

dev bookmarklet source code:

```
javascript:(function (src){ var d = window.document; d.head.appendChild(d.createElement('script')).src = src}('https://localhost:3000/index.js'));
```

prod bookmarklet:

[pick](javascript:(function (src){ var d = window.document; d.head.appendChild(d.createElement('script')).src = src}('https://1602.github.io/awtomato.elm/index.js')));

