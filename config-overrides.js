const path = require('path');
const { override, addWebpackPlugin } = require('customize-cra');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = override(
  // 添加多入口配置
  (config) => {
    config.entry = {
      main: path.join(__dirname, 'src/index.ts'),
      popup: path.join(__dirname, 'src/popup/popup.tsx'),
      options: path.join(__dirname, 'src/options/options.tsx'),
      // 添加 service worker 入口，并命名为 service-worker
      'service-worker': path.join(__dirname, 'src/service/worker.ts')
    };

    // 修改输出配置，将 service-worker.js 输出到根目录
    config.output.filename = (pathData) => {
      return pathData.chunk.name === 'service-worker' 
        ? '[name].js'  // service worker 输出到根目录
        : 'static/js/[name].js'; // 其他文件保持原路径
    };
    
    // 移除 runtime chunk 分离，确保每个入口文件包含所需的所有代码
    config.optimization.runtimeChunk = false;
    config.optimization.splitChunks = {
      cacheGroups: {
        default: false,
      },
    };

    // 移除 webpack-manifest-plugin 以禁用 asset-manifest.json 的生成
    config.plugins = config.plugins.filter(
      (plugin) => plugin.constructor.name !== "WebpackManifestPlugin"
    );

    return config;
  },
  
  // 添加复制插件，复制 manifest.json 和图标等静态资源
  addWebpackPlugin(
    new CopyPlugin({
      patterns: [
        { 
          from: "public", 
          to: "", 
          globOptions: {
            ignore: ["**/index.html", "**/options.html", "**/popup.html"]
          }
        }
      ],
    })
  ),
  
  // 添加 HTML 插件，为 popup 和 options 生成 HTML 文件
  (config) => {
    // 移除所有现有的 HtmlWebpackPlugin 实例
    config.plugins = config.plugins.filter(
      (plugin) => plugin.constructor.name !== "HtmlWebpackPlugin"
    );
    
    // 添加 popup.html
    config.plugins.push(
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "public/index.html"),
        filename: "popup.html",
        chunks: ["popup"],
        inject: true,
      })
    );
    
    // 添加 options.html
    config.plugins.push(
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "public/index.html"),
        filename: "options.html",
        chunks: ["options"],
        inject: true,
      })
    );
    
    return config;
  }
);