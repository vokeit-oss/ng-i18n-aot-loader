/**
 * @TODO: add license information
 */


const loaderUtils = require('loader-utils');
const assign      = require('object-assign');
const fs          = require('fs');
const core        = require('@angular/core');
const compiler    = require('@angular/compiler');
const htmlParser  = new compiler.HtmlParser();


/**
 * Get configuration of the loader
 */
function getLoaderConfig(context) {
    let query     = loaderUtils.getOptions(context) || {};
    let configKey = query.config || 'ng2I18nLoader';
    let config    = context.options && context.options.hasOwnProperty(configKey) ? context.options[configKey] : {};

    delete query.config;

    return assign(query, config);
}


/**
 * Recursive HTML visitor to render real HTML contents from parsed files
 */
class Visitor extends compiler.RecursiveVisitor {
    s4() {
       return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    
    
    /**
     * Uniq ID generator for automatically inserted template references
     */
    uniqId() {
        return (this.s4() + this.s4() + this.s4() + this.s4() + this.s4() + this.s4() + this.s4() + this.s4());
    }
    
    
    /**
     * Set if templates should be generated
     */
    generateTemplates(generate) {
        this.templateGeneration   = !!generate;
        this.templateElementCount = 0;
        
        if(this.templateGeneration) {
            this.templates   = [];
            this.templateIds = [];
        }
    }
    
    
    /**
     * Get automatically generated templates
     */
    getTemplates(asString) {
        return Array.isArray(this.templates) ? (!!asString ? this.templates.join('') : this.templates) : (!!asString ? '' : []);
    }
    
    
    /**
     * Full HTML element
     */
    visitElement(ast, context) {
        let attributes = ast.attrs.map((attr) => attr.visit(this)).filter((result) => result.length).join(' ');
        let children   = ast.children.map((child) => child.visit(this)).join('');
        let selfClose  = !children.length && compiler.getHtmlTagDefinition(ast.name).isVoid ? true : false;
        let element    = '<' + ast.name + (attributes.length ? ' ' + attributes : '') + (selfClose ? ' /' : '') + '>' + children + (selfClose ? '' : '</' + ast.name + '>');
        
        if(this.hasOwnProperty('templateGeneration') && 'router-outlet' === ast.name.toLowerCase() || 'ng-content' === ast.name.toLowerCase()) {
            if(!!this.templateGeneration) {
                this.templateIds.push(this.uniqId());
                this.templates.push('<ng-template #automaticallyGeneratedTemplate' + this.templateIds[this.templateElementCount] + '>' + element + '</ng-template>');
            }
            
            if(this.templateElementCount < this.templateIds.length) {
                element = '<ng-container *ngTemplateOutlet="automaticallyGeneratedTemplate' + this.templateIds[this.templateElementCount] + '"></ng-container>';
                
                ++this.templateElementCount;
            }
        }
        
        return element;
    }
    
    
    /**
     * Single attribute of an HTML element, removes all "i18n-*" attributes
     */
    visitAttribute(ast, context) {
        let value = ast.hasOwnProperty('children') ? ast.children.map((child) => child.visit(this)).join('') : ast.value;
        
        return ast.name.match(/^i18n(-.+)?$/) ? '' : ast.name + (value.length ? '="' + value + '"' : '');
    }
    
    
    /**
     * Plain text
     */
    visitText(ast, context) {
        return ast.value;
    }
    
    
    /**
     * HTML comment, angular does not provide those so responds with an empty string
     */
    visitComment(ast, context) {
        return '';
    }
    
    
    /**
     * Expansions for e.g. ICU messages (plural, select)
     */
    visitExpansion(ast, context) {
        let cases = ast.cases.map((caze) => caze.visit(this)).filter((result) => result.length).join(' ');
        
        return '{' + ast.switchValue + ', ' + ast.type + (cases.length ? ', ' + cases : '') + '}';
    }
    
    
    /**
     * Single case of an expansion
     */
    visitExpansionCase(ast, context) {
        return ast.value + ' {' + ast.expression.map((expression) => expression.visit(this)).join('') + '}';
    }
}


module.exports = function(content) {
    this.cacheable && this.cacheable();
    
    // Speed check - no i18n anywhere => no need to parse anythingm so skip as early as possible
    if(!content.match(/i18n/i)) {
        return content;
    }
    
    let config  = getLoaderConfig(this);
    let binding = config.hasOwnProperty('localeBinding') && 'string' === typeof config.localeBinding && config.localeBinding.length ? config.localeBinding : 'i18nLocaleBindingProperty';
    let result  = content;
    let formats = {'xliff': 'Xliff', 'xlf': 'Xliff', 'xliff2': 'Xliff2', 'xlf2': 'Xliff2', 'xmb': 'Xmb', 'xtb': 'Xtb'};
    
    if(!config.hasOwnProperty('enabled') || !config.enabled) {
        return result;
    }
    
    if('i18nLocaleBindingProperty' === binding) {
        console.warn('It seems there was no "localeBinding" specified in the config, falling back to default "i18nLocaleBindingProperty".');
    }
    
    if(!config.hasOwnProperty('translationFiles') || !Array.isArray(config.translationFiles) || 1 > config.translationFiles.length) {
        console.warn('It seems there were no "translationFiles" specified in the config, skipping.');
        
        return result;
    }
    
    if(!config.hasOwnProperty('translationFormat') || 'string' !== typeof config.translationFormat || !(config.translationFormat.toLowerCase() in formats)) {
        console.warn('It seems there was no (valid) "translationFormat" (supported: ' + Object.keys(formats).join(', ') + ') specified in the config, skipping.');
        
        return result;
    }
    
    let format     = config.translationFormat.toLowerCase();
    let serializer = new compiler[formats[format]]();
    let containers = '';
    
    // Check if there are i18n-tags inside the content
    let messageBundle = new compiler.MessageBundle(new compiler.I18NHtmlParser(htmlParser), [], {});
    messageBundle.updateFromTemplate(content, this.resourcePath, compiler.InterpolationConfig.fromArray(null));
    
    // No messages - no i18n-tags => no translations required
    if(1 > messageBundle.getMessages().length) {
        return result;
    }
    
    let locales            = [];
    let visitor            = new Visitor();
    let templatesGenerated = false;
    
    config.translationFiles.forEach(function(file) {
        let translationContent = fs.readFileSync(file);
        
        if(translationContent.length) {
            let translation    = serializer.load(translationContent.toString(), file);
            let locale         = translation.locale;
            let i18nHtmlParser = new compiler.I18NHtmlParser(htmlParser, translationContent.toString(), format, core.MissingTranslationStrategy.Warning);
            let parsed         = i18nHtmlParser.parse(content, this.resourcePath, true);
            
            if(1 > parsed.errors.length) {
                if(!templatesGenerated) {
                    visitor.generateTemplates(true);
                    
                    templatesGenerated = true;
                }
                else {
                    visitor.generateTemplates(false);
                }
                
                containers += '<ng-container *ngSwitchCase="\'' + String(locale) + '\'">' + compiler.visitAll(visitor, parsed.rootNodes).join('') + '</ng-container>';
            }
            else {
                console.error(parsed.errors);
            }
        }
    });
    
    if(containers.length) {
        let i18nHtmlParser = new compiler.I18NHtmlParser(htmlParser);
        let parsed         = i18nHtmlParser.parse(content, this.resourcePath, false);
        
        if(1 > parsed.errors.length) {
            if(!templatesGenerated) {
                visitor.generateTemplates(true);
                
                templatesGenerated = true;
            }
            else {
                visitor.generateTemplates(false);
            }
            
            containers += '<ng-container *ngSwitchDefault>' + compiler.visitAll(visitor, parsed.rootNodes).join('') + '</ng-container>';
            
            result = '<ng-container [ngSwitch]="' + binding + '">' + containers + '</ng-container>' + visitor.getTemplates(true);
        }
        else {
            console.error(parsed.errors);
        }
    }
    
    return result;
};