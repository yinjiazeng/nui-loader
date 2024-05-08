var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var loaderUtils = require('loader-utils');

var createHash = function(str){
    return crypto.createHash('md5').update(str).digest('hex').substr(0, 10);
}

var extract, paths, alias;

module.exports = function(source){
    var loader = this;

    var opts = loaderUtils.getOptions(loader) || {};

    if(!extract && opts.url && fs.existsSync(opts.url)){
        var buffer = fs.readFileSync(opts.url);
        var content = buffer.toString();
        var match = content.match(/Nui.config(\(\{((.|\s)*?)\}\))/);
        if(match){
            var obj = eval(match[1]);
            if(obj.paths){
                opts.paths = obj.paths
            }
            if(obj.alias){
                opts.alias = obj.alias
            }
        }
        extract = true
    }

    if(!alias && opts.alias){
        alias = {}
        for(var i in opts.alias){
            alias[i] = opts.alias[i]
        }
    }

    if(!paths && opts.paths){
        paths = {}
        var base = opts.base || opts.paths.base || path.join(__dirname, '../../');
        for(var i in opts.paths){
            var url = opts.paths[i];
            if(!/^(https?:)?\/\//i.test(url)){
                url = path.normalize(path.join(base, url)).replace(/\\/g, '/')
            }
            paths[i] = url
        }
    }

    //模块路径
    var resourcePath = loader.resourcePath;

    //文件扩展名
    var extname = path.extname(resourcePath);

    //包含扩展文件名
    var basename = path.basename(resourcePath);

    //扩展名位置
    var extIndex = basename.lastIndexOf(extname);

    //文件名
    var filename = basename;

    if(extname && extIndex !== -1){
        filename = basename.substr(0, extIndex)
    }

    //是否为Nui模块
    var nuiModule = !!source.match(/Nui\.define\(/g);

    //Nui.define(function(xx, xx, xx){}) => Nui.define(function(require, exports, module){})
    if(nuiModule){
        source = source.replace(/(Nui\.define\(\s*funtion\s*\()[^()]*(\))/g, '$1require, exports, module$2')
    }

    //Nui组件基类代码修改，转为获取模块数据方式转为webpack，options对应webpack的id
    if(nuiModule && filename === 'component'){
        source = source.replace(/require\s*\(\s*options\s*\)/, '__webpack_require__(options)')
    }

    //Nui.define => define
    source = source.replace(/Nui\.define\(/g, 'define(')

    //提取webpack模块id
    .replace(/((this|module)\.)?require\((['"][^'"]+['"])\s*,\s*true\)/g, function(str, pre, inner, name){
        return `(function(__callback__){
                var exps  = __callback__();
                var str   = __callback__.toString();
                var match = (/(\\d+)[^\\d]+$/).exec(str);
                if(match){
                    var id = match[1];
                    return {name:id, id:id, exports:exps}
                }
        })(function(){return require(${name})})`
    })

    /**懒加载
     * require.async('url', function(param){
     *     //...
     * })
     * =>
     * require.ensure([], function(require){
     *     var param = require('url');
     *     //...
     * })
     */
    .replace(/((this|module)\.)?require\.async\s*\(\s*(['"][^'"]+['"])\s*,\s*function\(([\w$]*)\)\s*\{/g, function(str, pre, inner, name, param){
        param = param.trim() || '__async_param_name__';
        return `require.ensure([], function(require){
            var ${param} = require(${name});
            `
    })

    //xxx.require，xxx.imports => require
    .replace(/(this|module)\.(require|imports)(\(['"][^'"]+['"])/g, 'require$3')

    //this.extend/module.extend => Nui.__moduleExtend
    .replace(/(this|module)\.extend\((['"][^'"]+['"])?/g, function(str, pre, mod){
        var req = '';
        if(mod){
            req = 'require('+ mod +')';
        }
        return 'Nui.__moduleExtend(\''+ filename +'\',' + req
    })

    //this.renders/module.renders => 字符串
    .replace(/(this|module)\.renders\(\{((.|\s)*?)\}\)/g, function(str, pre, code){
        return '(\''+code.replace(/'/g, "\\'").replace(/\\\\'/g, "'").replace(/([\r\n]+)(\s+)?/g, "'+''$1$2+'")+'\')'
    })

    //import '{xxx}/xxx'; from 'xxx'; require('xxx')
    //@import '{xxx}/xxx'; @import url('xxx')
    if(paths || alias){
        source = source.replace(/((@?import(\s+url\()?|from|require\s*\()\s*)(['"])([^'"]+)(['"])/g, function(str, pre, inner, url, qs, name, qe){
            //不包含路径，只有名称
            if(alias && /^[\w$]+$.test(name)/){
                if(alias[name]){
                    name = alias[name]
                }
            }
            if(paths){
                var match = name.match(/^\{([\w$]+)\}/);
                //包含别名
                if(match){
                    var _alias = match[1];
                    if(paths[_alias]){
                        name = name.replace(match[0], paths[_alias])
                    }
                    else{
                        loader.emitWarning('路径别名“ '+ _alias +' ”不存在')
                    }
                }
            }
            
            return pre + qs + name + qe;
        })
    }
    
    return source
}