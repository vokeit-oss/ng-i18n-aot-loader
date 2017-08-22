# ng-i18n-aot-loader [Proof-Of-Concept]
angular i18n pre-loader for webpack 2 to support AOT with dynamic locale changes

When building angular with AOT, at the time of writing, applications need to be built as separate bundles for each locale.  
To circumvent this "problem" you may use this pre-loader until the angular team has implemented a clean solution.


## What it does
The loader modifies the application's HTML before it get's passed to angular's compiler by rendering it for each locale and wrapping all translations into `ng-container`s.  
If you're using `ng-content` or `router-outlet` inside your templates those get filtered out and replaced by a template reference injected to the end of the HTML because they may only occur once per
document but would occur multiple times (your number of locales + 1) after modification.  
All bindings and contexts stay intact and there's no need to do special magic to your code.  
To actually change the displayed locale, a service is provided (by [@actra-development-oss/ng-i18n-aot-module](https://github.com/actra-development-oss/ng-i18n-aot-module)) that you may include in your component(s) to call `setLocale('new_locale')` on it.


## JIT and AOT
The loader works for both JIT and AOT builds and thus also with hot module replacement.  
Just keep in mind that when changing translatable texts inside your templates you have to extract the translations again as their message ids change.  
This is also true when not using this loader - it's the way angular calculates the message ids.  
So the process would be: `change html` => `extract texts` => `update translations` => `rebuild html`.  
Depending on your dev setup webpack may do the HTML rebuild automatically for you when the translation files change.  
If not you can trigger a HTML rebuild for individual files simply by updating the desired file, e.g. adding a new-line, and saving it for webpack to catch the change.


## Demo
A simple demo is hosted in a separate repository: https://github.com/actra-development-oss/ng-i18n-aot-demo  
Demo page: https://actra-development-oss.github.io/ng-i18n-aot-demo/


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
<ng-container *ngI18nAot="'automaticallyGeneratedUniqueIdPerHtmlFile'; locale: 'de-DE'">
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
<ng-container *ngI18nAot="'automaticallyGeneratedUniqueIdPerHtmlFile'; isDefault: true">
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
<ng-template #automaticallyGeneratedTemplate1><ng-content></ng-content></ng-template>
<ng-template #automaticallyGeneratedTemplate2><router-outlet></router-outlet></ng-template>
```


## Compatibility to angular syntax and tools
There's no need to learn **any** new syntax or tools.  
The loader uses plain angular i18n-syntax, so just tag your HTML with `i18n` or `i18n-<attributeName>` attributes as you would do in any regular angular 2 / 4 app.  
You can also still use e.g. the ng-xi18n tool from angular-cli to generate the translation sources.


## How to use it
Install the packages `npm install @actra-development-oss/ng-i18n-aot-loader @actra-development-oss/ng-i18n-aot-module` and define the loader as a pre-loader in your webpack config:
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
                        translationFiles:   ['/path/to/src/locales/messages.de.xlf'],
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

Include the module into your applications main module:
```typescript
import { NgI18nAotModule } from '@actra-development-oss/ng-i18n-aot-module';

// ...

@NgModule({
    // ...
    imports:      [
        NgI18nAotModule.forRoot(),
        // ...
    ],
    // ...
})
@Injectable()
export class ApplicationModule {
    // ...
}
```

Include the module into a) every module that uses translations *OR* b) once into your shared module that is included in all your modules.  
Code shows option b), include in shared module:
```typescript
import { NgI18nAotModule } from '@actra-development-oss/ng-i18n-aot-module';

// ...

@NgModule({
    // ...
    exports:      [
        NgI18nAotModule,
        // ...
    ],
    // ...
})
export class SharedModule {
}
```

To actually change the displayed locale use the service:
```typescript
import { NgI18nAotService } from '@actra-development-oss/ng-i18n-aot-module';

@Component({
    // ...
    template: `
        <button (click)="setLocale('en_US')">en_US</button> <button (click)="setLocale('de_DE')">de_DE</button><br />
        Current locale: {{locale}}
    `
})
export class MyComponent {
    public locale: string;
    
    
    constructor(protected ngI18nAotService: NgI18nAotService) {
        this.locale = this.ngI18nAotService.getLocale();
    }
    
    
    public setLocale(locale: string): void {
        this.locale = locale;
        
        this.ngI18nAotService.setLocale(this.locale);
    }
}
```


## Options
| Option            | Type     | Explanation |
|-------------------|----------|-------------------------------------------------------------|
| enabled           | boolean  | Whether the loader should modify the HTML or not.           |
| translationFiles  | string[] | Paths of all your locale files to render.                   |
| translationFormat | string   | Format of the translation files as used by angular:<br />xlf / xliff, xlf2 / xliff2, xmb, xtb |
