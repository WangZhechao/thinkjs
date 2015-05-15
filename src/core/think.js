'use strict';

var fs = require('fs');
var path = require('path');
var thinkit = require('thinkit');
var co = require('co');
var util = require('util');
var crypto = require('crypto');
var querystring = require('querystring');

/**
 * global think variable
 * @type {Object}
 */
global.think = Object.create(thinkit);

/**
 * check object is http object
 * @param  {Mixed}  http []
 * @return {Boolean}      []
 */
think.isHttp = function(http){
  return http && think.isObject(http.req) && think.isObject(http.res);
}
/**
 * server start time
 * @type {Number}
 */
think.startTime = Date.now();
/**
 * create class
 * @param {Object} methods [methods and props]
 */
think._Class = think.Class;
think.Class = function(type, clean){
  // think.Class({})
  // think.Class({}, true)
  if (think.isObject(type)) {
    return clean === true ? think._Class(type) : think._Class(think.Base, type);
  }
  // think.Class(function(){}, {})
  else if (think.isFunction(type)) {
    return think._Class(type, clean);
  }
  //create class
  return function(superClass, methods){
    // think.controller();
    // think.controller({})
    if (think.isObject(superClass) || !superClass) {
      methods = superClass;
      superClass = type + '_base';
    }
    // think.controller('superClass', {})
    else if (think.isString(superClass)) {
      superClass = think.lookClass(superClass, type);
    }
    if (think.isString(superClass)) {
      superClass = think.require(superClass);
      // get class
      // think.controller('rest')
      if (!methods) {
        return superClass;
      }
    }
    return think._Class(superClass, methods);
  }
}
/**
 * look up class
 * @param  {String} type   [class type, model, controller, service]
 * @param  {String} module [module name]
 * @return {String}        []
 */
think.lookClass = function(name, type, module){
  var names = name.split('/');
  switch(names.length){
    // home/controller/base
    case 3:
      return think.require(name);
    // home/base
    case 2:
      return think.require(names[0] + '/' + type + '/' + names[1]);
    // base
    case 1:
      var clsPath, cls;
      // find from current module
      if (module) {
        clsPath = module + '/' + type + '/' + name;
        cls = think.require(clsPath, true);
        if (cls) {
          return cls;
        }
      }
      // find from common module
      module = think.mini ? think.config('default_module') : think.dirname.common;
      clsPath = module + '/' + type + '/' + name;
      cls = think.require(clsPath, true);
      if (cls) {
        return cls;
      }
      // find from sys class
      return think.require(type + '_' + name);
  }
}
/**
 * base class
 * @type {}
 */
think.Base = require('./base.js');

/**
 * app dir name, can be set in init
 * @type {Object}
 */
think.dirname = {
  config: 'config',
  controller: 'controller',
  model: 'model',
  adapter: 'adapter',
  logic: 'logic',
  service: 'service',
  view: 'view',
  middleware: 'middleware',
  runtime: 'runtime',
  common: 'common',
  bootstrap: 'bootstrap',
  local: 'local'
}
/**
 * debug
 * @type {Boolean}
 */
think.debug = false;
/**
 * server port
 * @type {Number}
 */
think.port = 0;
/**
 * app mode
 * @type {String}
 */
think.mode = 'http';
/**
 * mini app mode
 * @type {Boolean}
 */
think.mini = false;
/**
 * thinkjs module root path
 * @type {String}
 */
think.THINK_PATH = path.normalize(__dirname + '/../../');
/**
 * thinkjs module lib path
 * @type {String}
 */
think.THINK_LIB_PATH = path.normalize(__dirname + '/../');
/**
 * thinkjs version
 * @param  {) []
 * @return {}         []
 */
think.version = (function(){
  var packageFile = think.THINK_PATH + '/package.json';
  var json = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
  return json.version;
})();

/**
 * module list
 * @type {Array}
 */
think.module = [];

/**
 * alias co module to think.co
 * @type {Object}
 */
think.co = co;
/**
 * get common module path
 * @return {String} []
 */
think.getModulePath = function(module){
  if (think.mini) {
    return think.APP_PATH;
  }
  module = module || think.dirname.common;
  return think.APP_PATH + '/' + module;
}

/**
 * require module
 * @param  {String} name []
 * @return {mixed}      []
 */
think.require = function(name, flag){
  if (!think.isString(name)) {
    return name;
  }
  if (think._aliasExport[name]) {
    return think._aliasExport[name];
  }

  function load(name, filepath){
    var obj = think.safeRequire(filepath);
    if (think.isClass(obj)) {
      obj.prototype.__filename = filepath;
    }
    //think._aliasExport[name] = obj;
    return obj;
  }

  if (think._alias[name]) {
    return load(name, think._alias[name]);
  }
  // only check in alias
  if (flag) {
    return;
  }
  var filepath = require.resolve(name);
  return load(filepath, filepath);
}
/**
 * safe require
 * @param  {String} file []
 * @return {mixed}      []
 */
think.safeRequire = function(file){
  // absolute file path is not exist
  if (path.isAbsolute(file) && !think.isFile(file)) {
    return null;
  }
  try{
    return require(file);
  }catch(e){
    if (think.debug) {
      console.error(e.stack);
    }
  }
  return null;
}
/**
 * log
 * @TODO
 * @return {} []
 */
think.log = function(msg/*, type*/){
  if (think.isError(msg)) {
    console.log(msg.stack);
    return;
  }
  console.log(msg);
}

/**
 * think sys & common config
 * @type {Object}
 */
think._config = {};
/**
 * get or set config
 * @return {mixed} []
 */
think.config = function(name, value, data){
  data = data || think._config;
  // get all config
  // think.config();
  if (name === undefined) {
    return data;
  }
  // merge config
  // think.config({name: 'welefen'})
  else if (think.isObject(name)) {
    think.extend(data, name);
  }
  // set or get config
  else if(think.isString(name)){
    name = name.toLowerCase();
    //one grade config
    if (name.indexOf('.') === -1) {
      if (value === undefined) {
        return data[name];
      }
      data[name] = value;
      return;
    }
    name = name.split('.');
    if (value === undefined) {
      value = data[name[0]] || {};
      return value[name[1]];
    }
    if (!(name[0] in data)) {
      data[name[0]] = {};
    }
    data[name[0]][name[1]] = value;
  }
}
/**
 * modules config
 * @type {Object}
 */
think._moduleConfig = {};
/**
 * get module config
 * @param  {String} module []
 * @return {Object}        []
 */
think.getModuleConfig = function(module){
  module = module || think.dirname.common;
  if (!think.debug && module in think._moduleConfig) {
    return think._moduleConfig[module];
  }
  var rootPath;
  if (module === true) {
    rootPath = think.THINK_LIB_PATH + '/config';
  }else{
    rootPath = think.getModulePath(module) + '/' + think.dirname.config;
  }
  //config.js
  var file = rootPath + '/config.js';
  var config = think.safeRequire(file);
  //mode
  file = rootPath + '/' + think.mode + '.js';
  var modeConfig = think.safeRequire(file);
  config = think.extend({}, config, modeConfig);
  if (think.debug) {
    //debug.js
    file = rootPath + '/debug.js';
    config = think.extend(config, think.safeRequire(file));
  }
  if (module && module !== true) {
    config = think.extend({}, think._config, config);
  }
  //transform config
  var transforms = require(think.THINK_LIB_PATH + '/config/transform.js');
  config = think.transformConfig(config, transforms);
  think._moduleConfig[module] = config;
  return config;
}
/**
 * transform config
 * @param  {Object} config []
 * @return {Object}        []
 */
think.transformConfig = function(config, transforms){
  for(var key in transforms){
    if (!(key in config)) {
      continue;
    }
    var value = transforms[key];
    if (think.isFunction(value)) {
      config[key] = value(config[key]);
    }else {
      config[key] = think.transformConfig(config[key], value);
    }
  }
  return config;
}
/**
 * hook list
 * @type {Object}
 */
think._hook = {};
/**
 * exec hook
 * @param  {String} name []
 * @return {}      []
 */
think.hook = function(name, http, data){
  //get hook data
  if (arguments.length === 1) {
    return think._hook[name] || [];
  }
  //set hook data
  else if (think.isArray(http)) {
    think._hook[name] = http;
    return;
  }
  var list = think._hook[name] || [];
  var index = 0, length = list.length;
  if (length === 0) {
    return Promise.resolve(data);
  }
  http = http || {};
  http._middleware = data;
  function execMiddleware(){
    if (index >= length) {
      return Promise.resolve(http._middleware);
    }
    var item = list[index++];
    return think.middleware(item, http, http._middleware).then(function(data){
      if (data !== undefined) {
        http._middleware = data;
      }
      return execMiddleware();
    });
  }
  return execMiddleware();
}
/**
 * create or exec middleware
 * @param  {Function} superClass []
 * @param  {Object} methods      []
 * @return {mixed}            []
 */
var middleware = null;
think._middleware = {};
think.middleware = function(superClass, methods, data){
  var length = arguments.length;
  var prefix = 'middleware_';
  // register functional middleware
  // think.middleware('parsePayLoad', function(){})
  if (think.isString(superClass) && think.isFunction(methods)) {
    think._middleware[superClass] = methods;
    return;
  }
  // exec middleware
  // think.middleware('parsePayLoad', http, data)
  if (length >= 2 && think.isHttp(methods)) {
    var name = superClass, http = methods;
    if (name in think._middleware) {
      var fn = think._middleware[name];
      return think.co.wrap(fn)(http, data);
    }else if (think.isString(name)) {
      var instance = think.require(prefix + name)(http);
      return think.co.wrap(instance.run).bind(instance)(data);
    }else if (think.isFunction(name)){
      return think.co.wrap(name)(http, data);
    }
  }
  // get middleware
  // think.middleware('parsePayLoad')
  if (length === 1 && think.isString(superClass)) {
    var cls = think.require(prefix + superClass, true);
    if (cls) {
      return cls;
    }
    throw new Error(think.message('MIDDLEWARE_NOT_FOUND', superClass));
  }
  if (!middleware) {
    middleware = think.Class('middleware');
  }
  // create middleware
  return middleware(superClass, methods);
}
/**
 * create, register, call adapter
 * @param  {String} name []
 * @return {void}      []
 */
think.adapter = function(type, name, fn){
  //load sys adapter
  think.loadAdapter();

  var length = arguments.length, key = 'adapter_';
  //register adapter
  //think.adapter('session', 'redis', function(){})
  if (length === 3 && think.isFunction(fn)) {
    key += type + '_' + name;
    think._aliasExport[key] = fn;
    return;
  }
  //create adapter
  //module.exports = think.adapter('session', 'base', {})
  if (length === 3 && think.isObject(fn)) {
    return think.Class(think.adapter(type, name), fn);
  }
  //get adapter
  //think.adapter('session', 'redis')
  if (length === 2 && think.isString(name)) {
    key += type + '_' + name;
    var cls = think.require(key, true);
    if (cls) {
      return cls;
    }
    throw new Error(think.message('ADAPTER_NOT_FOUND', key));
  }
  //create adapter
  //module.exports = think.adapter({})
  //module.exports = think.adapter(function(){}, {});
  var superClass;
  if (think.isFunction(type)) {
    superClass = type;
  }else if (think.isString(type)) {
    superClass = think.require(type);
  }
  //create clean Class
  if (!superClass) {
    return think.Class(type, true);
  }
  return think.Class(superClass, name);
}
/**
 * load system & comon module adapter
 * @return {} []
 */
var adapterLoaded = false;
think.loadAdapter = function(force){
  if (adapterLoaded && !force) {
    return;
  }
  adapterLoaded = true;
  var paths = [think.THINK_LIB_PATH + '/adapter'];
  //common module adapter
  var adapterPath = think.getModulePath() + '/' + think.dirname.adapter;
  if (think.isDir(adapterPath)) {
    paths.push(adapterPath);
  }
  paths.forEach(function(path){
    var dirs = fs.readdirSync(path);
    dirs.forEach(function(dir){
      think.alias('adapter_' + dir, path + '/' + dir);
    })
  })
}

/**
 * module alias
 * @type {Object}
 */
think._alias = {};
/**
 * module alias export
 * @type {Object}
 */
think._aliasExport = {};
/**
 * load alias
 * @param  {String} type  []
 * @param  {Array} paths []
 * @return {Object}       []
 */
think.alias = function(type, paths, slash){
  //regist alias
  if (!think.isArray(paths)) {
    paths = [paths];
  }
  paths.forEach(function(path){
    var files = think.getFiles(path);
    files.forEach(function(file){
      var name = file.slice(0, -3);
      name = type + (slash ? '/' : '_') + name;
      think._alias[name] = path + '/' + file;
    })
  })
}
/**
 * route list
 * @type {Array}
 */
think._route = null;
/**
 * load route
 * @return {} []
 */
think.route = function(clear){
  if (clear) {
    //clear route
    if (clear === true) {
      think._route = null;
    }
    //set route
    else if (think.isArray(clear)) {
      think._route = clear;
    }
    return;
  }
  if (think._route !== null) {
    return think._route;
  }
  var file = think.getModulePath() + '/' + think.dirname.config + '/route.js';
  var config = think.safeRequire(file);
  //route config is funciton
  //may be is dynamic save in db
  if (think.isFunction(config)) {
    var fn = think.co.wrap(config);
    return fn().then(function(route){
      think._route = route || [];
      return think._route;
    })
  }
  think._route = config || [];
  return think._route;
}
/**
 * thinkjs timer list
 * @type {Object}
 */
think.timer = {};
/**
 * regist gc
 * @param  {Object} instance [class instance]
 * @return {}          []
 */
think.gc = function(instance){
  if (!instance || !instance.gcType) {
    throw new Error(think.message('GCTYPE_MUST_SET'));
  }
  var type = instance.gcType;
  if (think.debug || think.mode === 'cli' || type in think.timer) {
    return;
  }
  think.timer[type] = setInterval(function(){
    var hour = (new Date()).getHours();
    var hours = think._config.cache_gc_hour || [];
    if (hours.indexOf(hour) === -1) {
      return;
    }
    return instance.gc && instance.gc(Date.now());
  }, 3600 * 1000);
}
/**
 * local ip
 * @type {String}
 */
think.localIp = '127.0.0.1';
/**
 * get http object
 * @param  {Object} req [http request]
 * @param  {Object} res [http response]
 * @return {Object}     [http object]
 */
var http;
think._http = function(data){
  data = data || {};
  if (think.isString(data)) {
    if (data[0] === '{') {
      data = JSON.parse(data);
    }else if (/^[\w]+\=/.test(data)) {
      data = querystring.parse(data);
    }else{
      data = {url: data};
    }
  }
  var url = data.url || '';
  if (url.indexOf('/') !== 0) {
    url = '/' + url;
  }
  var req = {
    httpVersion: '1.1',
    method: (data.method || 'GET').toUpperCase(),
    url: url,
    headers: think.extend({
      host: data.host || think.localIp
    }, data.headers),
    connection: {
      remoteAddress: data.ip || think.localIp
    }
  }
  var res = {
    end: data.end || data.close || function(){},
    write: data.write || data.send || function(){},
    setHeader: function(){}
  }
  return {
    req: req,
    res: res
  }
}
think.http = function(req, res){
  if (!http) {
    http = think.require('http');
  }
  //for cli request
  if (arguments.length === 1) {
    var data = think._http(req);
    req = data.req;
    res = data.res;
  }
  return http(req, res).run();
}
/**
 * get uuid
 * @param  {Number} length [uid length]
 * @return {String}        []
 */
think.uuid = function(length){
  length = length || 32;
  var str = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64').slice(0, length);
  return str.replace(/[\+\/]/g, '_');
}
/**
 * start session
 * @param  {Object} http []
 * @return {}      []
 */
var Cookie;
think.session = function(http){
  if (http.session) {
    return http.session;
  }
  if (!Cookie) {
    Cookie = think.require('cookie');
  }
  var sessionOptions = think.config('session');
  var name = sessionOptions.name;
  var sign = sessionOptions.sign;
  var cookie = http._cookie[name];
  //validate cookie sign
  if (cookie && sign) {
    cookie = Cookie.unsign(cookie, sign);
    //set unsigned cookie to http._cookie
    if (cookie) {
      http._cookie[name] = cookie;
    }
  }
  var sessionCookie = cookie;
  if (!cookie) {
    var options = sessionOptions.cookie || {};
    cookie = think.uuid(options.length || 32);
    sessionCookie = cookie;
    //sign cookie
    if (sign) {
      cookie = Cookie.sign(cookie, sign);
    }
    http._cookie[name] = sessionCookie;
    http.cookie(name, cookie, options);
  }
  var type = sessionOptions.type;
  type = type || 'base';
  if (type === 'base') {
    if (think.debug || think.config('cluster_on')) {
      type = 'file';
      think.log("in debug or cluster mode, session can't use memory for storage, convert to File");
    }
  }
  var session = think.adapter('session', type)({
    cookie: sessionCookie,
    timeout: sessionOptions.timeout
  });
  http.session = session;
  http.on('afterEnd', function(){
    //stor session data
    return session.flush && session.flush();
  })
  return session;
}
/**
 * get module name
 * @param  {String} module []
 * @return {String}        []
 */
think.getModule = function(module){
  if (!module || think.mini) {
    return think.config('default_module');
  }
  return module.toLowerCase();
}

var nameReg = /^[A-Za-z\_]\w*$/;
think.getController = function(controller){
  if (!controller) {
    return think.config('default_controller');
  }
  if (nameReg.test(controller)) {
    return controller.toLowerCase();
  }
  return '';
}
/**
 * get action
 * @param  {String} action [action name]
 * @return {String}        []
 */
think.getAction = function(action){
  if (!action) {
    return think.config('default_action');
  }
  if (nameReg.test(action)) {
    return action;
  }
  return '';
}
/**
 * create controller sub class
 * @type {Function}
 */
think._controller = think.Class('controller');
think.controller = function(superClass, methods, module){
  var isConfig = think.isHttp(methods) || module;
  // get controller instance
  if (think.isString(superClass) && isConfig) {
    var cls = think._controller(superClass, 'controller', module);
    return cls(methods);
  }
  //create sub controller class
  return think._controller(superClass, methods);
}
/**
 * create logic class
 * @type {Function}
 */
think._logic = think.Class('logic');
think.logic = function(superClass, methods, module){
  var isConfig = think.isHttp(methods) || module;
  //get logic instance
  if (think.isString(superClass) && isConfig) {
    var cls = think.lookClass(superClass, 'logic', module);
    return cls(methods);
  }
  //create sub logic class
  return think._logic(superClass, methods);
}
/**
 * create model sub class
 * @type {Function}
 */
think._model = think.Class('model');
think.model = function(superClass, methods, module){
  var isConfig = methods === true || module;
  if (!isConfig && methods) {
    //db configs
    if ('host' in methods && 'type' in methods && 'port' in methods) {
      isConfig = true;
    }
  }
  //get model instance
  if (think.isString(superClass) && isConfig) {
    methods = think.extend({}, think.config('db'), methods);
    var cls = think.lookClass(superClass, 'model', module);
    return cls(methods);
  }
  //create model
  return think._model(superClass, methods);
}
//model relation type
think.HAS_ONE = 1;
think.BELONG_TO = 2;
think.HAS_MANY = 3;
think.MANY_TO_MANY = 4;

/**
 * create service sub class
 * @type {Function}
 */
think._service = think.Class('service');
think.service = function(superClass, methods, module){
  var isConfig = think.isHttp(methods) || methods === true || module;
  //get service instance
  if (think.isString(superClass) && isConfig) {
    var cls = think.lookClass(superClass, 'service', module);
    if (think.isClass(cls)) {
      return cls(methods);
    }
    return cls;
  }
  //create sub service class
  return this._service(superClass, methods);
}
/**
 * get error message
 * @param  {String} type [error type]
 * @param  {Array} data []
 * @return {}      []
 */
think._message = {};
think.message = function(type, data){
  if (!think.isArray(data)) {
    data = [].slice.call(arguments, 1);
  }
  var msg = think._message[type];
  if (!msg) {
    return;
  }
  data.unshift(msg);
  return util.format.apply(util, data);
}
/**
 * get or set cache
 * @param  {String} type  [cache type]
 * @param  {String} name  [cache name]
 * @param  {Mixed} value [cache value]
 * @return {}       []
 */
think.cache = function(name, value, options){
  options = options || {};
  var type = options.type || 'base';
  var instance = think.adapter('cache', type)(options);
  var isFn = think.isFunction(instance.__before);
  var promise = Promise.resolve(isFn ? instance.__before(name) : undefined);
  return promise.then(function(){
    //get cache
    if (value === undefined) {
      return instance.get(name);
    }
    //remove cache
    else if (value === null) {
      return instance.rm(name);
    }
    //set cache
    return instance.set(name, value);
  })
}
/**
 * valid data
 * [{
 *   name: 'xxx',
 *   type: 'xxx',
 *   value: 'xxx',
 *   required: true,
 *   _default: 'xxx',
 *   args: []
 *   msg: ''
 * }, ...]
 * @param  {String | Object}   name     []
 * @param  {Function} callback []
 * @return {}            []
 */
think._valid = null;
think.valid = function(name, callback){
  if (!think._valid) {
    think._valid = think.require('valid');
  }
  if (think.isString(name)) {
    // register valid callback
    // think.valid('test', function(){})
    if (think.isFunction(callback)) {
      think._valid[name] = callback;
      return;
    }
    // get valid callback
    return think._valid[name];
  }
  // convert object to array
  if (think.isObject(name)) {
    var data = [];
    for(var key in name){
      var value = name[key];
      value.name = key;
      data.push(value);
    }
    name = data;
  }
  var ret = {}, msg = {};
  name.forEach(function(item){
    // value required
    if (item.required) {
      if (!item.value) {
        msg[item.name] = think.message('PARAMS_EMPTY', item.name);
        return;
      }
    }else{
      if (!item.value) {
        //set default value
        if (item._default) {
          ret[item.name] = item._default;
        }
        return;
      }
    }
    ret[item.name] = item.value;
    if (!item.type) {
      return;
    }
    var type = think._valid[item.type];
    if (!think.isFunction(type)) {
      throw new Error(think.message('CONFIG_NOT_FUNCTION', item.type));
    }
    if (!think.isArray(item.args)) {
      item.args = [item.args];
    }
    item.args = item.args.unshift(item.value);
    var result = type.apply(think._valid, item.args);
    if (!result) {
      var itemMsg = item.msg || think.message('PARAMS_NOT_VALID');
      msg[item.name] = itemMsg.replace('{name}', item.name).replace('{valud}', item.value);
    }
  })
  return {
    msg: msg,
    data: ret
  }
}


/**
 * global cache
 * @type {Object}
 */
global.thinkCache = function(type, name, value){
  type = '_' + type;
  if (!(type in thinkCache)) {
    thinkCache[type] = {};
  }
  // get cache
  if (name === undefined) {
    return thinkCache[type];
  }
  // get cache
  else if (value === undefined) {
    if (think.isString(name)) {
      return thinkCache[type][name];
    }
    thinkCache[type] = name;
    return;
  }
  //remove cache
  else if (value === null) {
    delete thinkCache[type][name];
    return;
  }
  //set cache
  thinkCache[type][name] = value;
};
//cache key
thinkCache.BASE = 'base';
thinkCache.TEMPLATE = 'template';
thinkCache.DB = 'db';
thinkCache.SESSION = 'session';
thinkCache.REDIS = 'redis';
thinkCache.MEMCACHE = 'memcache';
thinkCache.FILE = 'file';