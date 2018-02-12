<div align="center">
  <h1>Nui Loader</h1>
</div>

<h2 align="center">介绍</h2>
nui-loader是Nui框架兼容webpack的转换器，能够将框架自身特性转换为webpack可识别的语法。

<h2 align="center">安装</h2>

```bash
npm install --save-dev nui-loader
```

<h2 align="center">使用</h2>

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['nui-loader']
      }
    ]
  }
}
```

<h2 align="center">注意事项</h2>

编写模块代码时，4个工厂函数require/imports/extend/renders中除了require，其它三个必须加this.或者module.前缀，否则转换器将无法识别
```js
Nui.define(function(){
  var module = this

  this.imports('xxxx')

  this.extend('xxxx', {

  })

  module.renders({
    <div></div>
  })

})
```
