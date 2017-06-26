# actra-ng-i18n-loader [Proof-Of-Concept]
angular i18n pre-loader for webpack 2 to support AOT with dynamic locale changes

When building angular with AOT, at the time of writing, applications needs to be built as separate bundles for each locale.  
To circumvent this "problem" you may use this pre-loader until the angular team has implemented a clean solution.


## What it does
The loader modifies the application's HTML before it get's passed to angular's compiler by rendering it for each locale and wrapping all translations into `ng-container`s with `ng-switch`.  
If you're using `ng-content` or `router-outlet` inside your templates those get filtered out and replaced by a template reference injected to the end of the HTML because they may only occur once per
document but would occur multiple times (your number of locales + 1) after modification.  
All bindings and contexts stay intact and there's no need to do special magic to your code.


## Compatibility to angular syntax and tools
There's no need to learn **any** new syntax or tools.  
The loader uses plain angular i18n-syntax, so just tag your HTML with `i18n` or `i18n-<attributeName>` attributes.  
You can also use e.g. the ng-xi18n tool from angular-cli to generate the translation sources.


## How to use it
Install the package `npm install @actra-development/actra-ng-i18n-loader` and define it as a pre-loader in your webpack config:
```js
module: {
    rules: [
        {
            enforce: 'pre',
            test:    /\.html$/,
            use:     [
                {
                    loader:  '@actra-development/actra-ng-i18n-loader',
                    options: {
                        enabled:            true,
                        localeBinding:      'locale',
                        translationFiles:   glob.sync('/path/to/src/locales/**/messages.*.xlf'),
                        translationFormat: 'xliff'
                    }
                }
            ],
            include: [
                '/path/to/src'
            ],
            exclude: [
                '/path/to/src/index.html'
            ]
        },
        // your other loaders...
    ]
}
```

In every component that has a translatable template you now need to specify the public property `locale` in order for the `ng-switch` to fire:
```js
@Component({
    // ...
})
export class MyComponent {
    public locale: string = 'en_US';
}
```

To actually switch the locale, the component has to be notified of changes to the locale, e.g. by subscribing to a service, useing a redux-store or whatever you like.  
In my test-project I used redux with it's `@select()`-syntax and subscribed my components like so:
```js
@Component({
    // ...
})
export class MyComponent {
    @select(['application', 'locale']) public locale$: Observable<string>;
}
```

As this now is an observable the loader-config needs to be sligthly adjusted so the `localeBinding` is recognized as async:
```js
// ...
    use: [
        {
            loader:  '@actra-development/actra-ng-i18n-loader',
            options: {
                localeBinding: 'locale$ | async'
            }
        }
    ]
// ...
```


## Options
| Option            | Type    | Explanation |
|-------------------|---------|------------------------------------------------------------|
| enabled           | boolean | Whether the loader should render HTML or not.              |
| localeBinding     | string  | Name of your component's property that holds the locale.<br />When using an observable don't forget to specify as such:<br />e.g. `locale$ \| async` |
| translationFiles  | array   | Paths of all your locale files to render.                  |
| translationFormat | string  | Format of the translation files as used by angular:<br />xlf / xliff, xlf2 / xliff2, xmb, xtb |


## Known caveats
As `ng-switch` on the used `ng-containers` removes the dom entirely, angular may (think to) detect expression changes after the view has been checked.  
This simply is a timing problem, I didn't find a solid workaround for this until now.  
As those console messages are disabled for production builds by angular just forget about them.
