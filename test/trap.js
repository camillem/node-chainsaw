var test = require('tap').test;
var chainsaw = require('../');

test('trap', function (t) {
    t.plan(3);
    
    var error = null;
    var ch = chainsaw(function (saw) {
        var pars = 0;
        var stack = [];
        var i = 0;
        
        this.par = function (cb) {
            pars ++;
            var j = i ++;
            cb.call(function () {
                pars --;
                stack[j] = [].slice.call(arguments);
                saw.down('result');
            });
            saw.next();
        };
        
        this.join = function (cb) {
            saw.trap('result', function () {
                if (pars == 0) {
                    cb.apply(this, stack);
                    saw.next();
                }
            });
        };
        
        this.raise = function (err) {
            error = err;
            saw.down('catch');
        };
        
        this.do = function (cb) {
            cb.call(this);
        };
        
        this.catch = function (cb) {
            if (error) {
                saw.nest(cb, error);
                error = null;
            }
            else saw.next();
        };
    });
    
    var joined = false;
    ch
        .par(function () {
            setTimeout(this.bind(null, 1), 50);
        })
        .par(function () {
            setTimeout(this.bind(null, 2), 25);
        })
        .join(function (x, y) {
            t.equal(x[0], 1);
            t.equal(y[0], 2);
            joined = true;
        })
        .do(function () {
            t.ok(joined);
        })
    ;
});
