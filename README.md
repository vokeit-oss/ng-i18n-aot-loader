# ng-i18n-aot-loader [Proof-Of-Concept]
angular i18n pre-loader for webpack 2 to support AOT with dynamic locale changes

When building angular with AOT, at the time of writing, applications need to be built as separate bundles for each locale.  
To circumvent this "problem" you may use this pre-loader until the angular team has implemented a clean solution.


## What it does
The loader modifies the application's HTML before it get's passed to angular's compiler by rendering it for each locale and wrapping all translations into `ng-container`s with `ng-switch`.  
If you're using `ng-content` or `router-outlet` inside your templates those get filtered out and replaced by a template reference injected to the end of the HTML because they may only occur once per
document but would occur multiple times (your number of locales + 1) after modification.  
All bindings and contexts stay intact and there's no need to do special magic to your code.


## JIT and AOT
The loader works for both JIT and AOT builds and thus also with hot module replacement.  
Just keep in mind that when changing translatable texts inside your templates you have to extract the translations again as their message ids change.  
This is also true when not using this loader - it's the way angular calculates the message ids.  
So the process would be: `change html` => `extract texts` => `update translations` => `rebuild html`.  
Depending on your dev setup webpack may to the HTML rebuild automatically for you when the translation files change.  
If not you can trigger a HTML rebuild for individual files simply by updating the desired file, e.g. adding a new-line, and saving it for webpack to catch the change.


## Example
Given this (partial) source:
```html
<div class="mat-app-background">
    <ng-content></ng-content>
    
    <md-chip-list>
        <md-chip i18n>First chip</md-chip>
        <md-chip color="primary" i18n i18n-title="Second chip title" title="Second chip :-)">Second chip</md-chip>
        <md-chip color="accent" i18n>Third chip</md-chip>
    </md-chip-list>
    
    <router-outlet></router-outlet>
</div>
```

The loader would produce this result, given one locale "de-DE" translation file:
```html
<ng-container [ngSwitch]="locale">
    <ng-container *ngSwitchCase="'de-DE'">
        <div class="mat-app-background">
            <ng-container *ngTemplateOutlet="automaticallyGeneratedTemplate1"></ng-container>
            
            <md-chip-list>
                <md-chip>Erster Chip</md-chip>
                <md-chip color="primary" title="Zweiter Chip :)">Zweiter Chip</md-chip>
                <md-chip color="accent">Dritter Chip</md-chip>
            </md-chip-list>
            
            <ng-container *ngTemplateOutlet="automaticallyGeneratedTemplate2"></ng-container>
        </div>
    </ng-container>
    <ng-container *ngSwitcDefault>
        <div class="mat-app-background">
            <ng-container *ngTemplateOutlet="automaticallyGeneratedTemplate1"></ng-container>
            
            <md-chip-list>
                <md-chip>First chip</md-chip>
                <md-chip color="primary" title="Second chip :-)">Second chip</md-chip>
                <md-chip color="accent">Third chip</md-chip>
            </md-chip-list>
            
            <ng-container *ngTemplateOutlet="automaticallyGeneratedTemplate2"></ng-container>
        </div>
    </ng-container>
</ng-container>
<ng-template #automaticallyGeneratedTemplate1><ng-content></ng-content></ng-template>
<ng-template #automaticallyGeneratedTemplate2><router-outlet></router-outlet></ng-template>
```


## Compatibility to angular syntax and tools
There's no need to learn **any** new syntax or tools.  
The loader uses plain angular i18n-syntax, so just tag your HTML with `i18n` or `i18n-<attributeName>` attributes as you would do in any regular angular 2 / 4 app.  
You can also still use e.g. the ng-xi18n tool from angular-cli to generate the translation sources.


## How to use it
Install the package `npm install @actra-development-oss/ng-i18n-aot-loader` and define it as a pre-loader in your webpack config:
```js
module: {
    rules: [
        {
            enforce: 'pre',
            test:    /\.html$/,
            use:     [
                {
                    loader:  '@actra-development-oss/ng-i18n-aot-loader',
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
NB: I'm using `glob.sync()` for the option `translationFiles` for convenience, any other tool would suffice as long as the result is an array of strings, you may even specify the paths by hand.

In every component that has a translatable template you now need to specify the public property `locale` in order for the `ng-switch` to fire:
```typescript
@Component({
    // ...
})
export class MyComponent {
    public locale: string = 'en_US';
}
```

To actually switch the locale, the component has to be notified of changes to the locale, e.g. by subscribing to a service, using a redux-store or whatever you like.  
In my test-project I used redux with it's `@select()`-syntax and subscribed my components like so:
```typescript
@Component({
    // ...
})
export class MyComponent {
    @select(['application', 'locale']) public locale$: Observable<string>;
}
```

As this now is an observable the loader-config needs to be sligthly adjusted so the `localeBinding` is recognized as async:
```typescript
// ...
    use: [
        {
            loader:  '@actra-development-oss/ng-i18n-aot-loader',
            options: {
                localeBinding: 'locale$ | async'
            }
        }
    ]
// ...
```


## Options
| Option            | Type     | Explanation |
|-------------------|----------|-------------------------------------------------------------|
| enabled           | boolean  | Whether the loader should modify the HTML or not.           |
| localeBinding     | string   | Name of your component's property that holds the locale.<br />When using an observable don't forget to specify as such:<br />e.g. `locale$ \| async` |
| translationFiles  | string[] | Paths of all your locale files to render.                   |
| translationFormat | string   | Format of the translation files as used by angular:<br />xlf / xliff, xlf2 / xliff2, xmb, xtb |


## Known caveats
As `ng-switch` on the used `ng-containers` removes the dom entirely, angular may (think to) detect expression changes after the view has been checked.  
This simply is a timing problem, I didn't find a solid workaround for this until now.  
As those console messages are disabled for production builds by angular just forget about them.
