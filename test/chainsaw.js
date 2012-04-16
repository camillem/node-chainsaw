var test = require('tap').test;
var chainsaw = require('../');

test('nestWait', function (t) {
    var ch = (function () {
        var vars = {};
        return chainsaw(function (saw) {
            this.do = function (cb) {
                saw.nest(cb, vars);
            };
            
            this.wait = function (n) {
                setTimeout(function () {
                    saw.next();
                }, n);
            };
        });
    })();
    
    var order = [];
    var to = setTimeout(function () {
        t.fail("Didn't get to the end");
    }, 1000);
    
    var times = {};
    
    ch
        .do(function (vars) {
            vars.x = 'y';
            order.push(1);
            
            this
                .do(function (vs) {
                    order.push(2);
                    vs.x = 'x';
                    times.x = Date.now();
                })
                .wait(50)
                .do(function (vs) {
                    order.push(3);
                    vs.z = 'z';
                    
                    times.z = Date.now();
                    var dt = times.z - times.x;
                    t.ok(dt >= 50 && dt < 75);
                })
            ;
        })
        .do(function (vars) {
            vars.y = 'y';
            order.push(4);
            
            times.y = Date.now();
        })
        .wait(100)
        .do(function (vars) {
            t.same(order, [1,2,3,4]);
            t.same(vars, { x : 'x', y : 'y', z : 'z' });
            clearTimeout(to);
            
            times.end = Date.now();
            var dt = times.end - times.y;
            t.ok(dt >= 100 && dt < 125)
        })
    ;
});

test('nestNext', function (t) {
    var ch = (function () {
        var vars = {};
        return chainsaw(function (saw) {
            this.do = function (cb) {
                saw.nest(false, function () {
                    var args = [].slice.call(arguments);
                    args.push(saw.next);
                    cb.apply(this, args);
                }, vars);
            };
        });
    })();
    
    var order = [];
    var to = setTimeout(function () {
        t.fail("Didn't get to the end");
    }, 500);
    
    var times = [];
    
    ch
        .do(function (vars, next_) {
            vars.x = 'y';
            order.push(1);
            
            this
                .do(function (vs, next) {
                    order.push(2);
                    vs.x = 'x';
                    setTimeout(next, 30);
                })
                .do(function (vs, next) {
                    order.push(3);
                    vs.z = 'z';
                    setTimeout(next, 10);
                })
                .do(function () {
                    setTimeout(next_, 20);
                })
            ;
        })
        .do(function (vars, next) {
            vars.y = 'y';
            order.push(4);
            setTimeout(next, 5);
        })
        .do(function (vars) {
            t.same(order, [1,2,3,4]);
            t.same(vars, { x : 'x', y : 'y', z : 'z' });
            
            clearTimeout(to);
        })
    ;
});

test('builder', function (t) {
    var cx = chainsaw(function (saw) {
        this.x = function () {};
    });
    t.ok(cx.x);
    
    var cy = chainsaw(function (saw) {
        return { y : function () {} };
    });
    t.ok(cy.y);
    
    var cz = chainsaw(function (saw) {
        return { z : function (cb) { saw.nest(cb) } };
    });
    t.ok(cz.z);
    
    var to = setTimeout(function () {
        t.fail("Nested z didn't run");
    }, 50);
    
    cz.z(function () {
        clearTimeout(to);
        t.ok(this.z);
    });
});

test('attr', function (t) {
    var to = setTimeout(function () {
        t.fail("attr chain didn't finish");
    }, 50);
    
    var xy = [];
    var ch = chainsaw(function (saw) {
        this.h = {
            x : function () { 
                xy.push('x');
                saw.next();
            },
            y : function () {
                xy.push('y');
                saw.next();
                t.same(xy, ['x','y']);
                clearTimeout(to);
            }
        };
    });
    t.ok(ch.h);
    t.ok(ch.h.x);
    t.ok(ch.h.y);
    
    ch.h.x().h.y();
});

test('down', function (t) {
    var error = null;
    var s;
    var ch = chainsaw(function (saw) {
        s = saw;
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
    
    var to = setTimeout(function () {
        t.fail(".do() after .catch() didn't fire");
    }, 50);
    
    ch
        .do(function () {
            this.raise('pow');
        })
        .do(function () {
            t.fail("raise didn't skip over this do block");
        })
        .catch(function (err) {
            t.equal(err, 'pow');
        })
        .do(function () {
            clearTimeout(to);
        })
    ;
});

test('trap', function (t) {
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
    
    var to = setTimeout(function () {
        t.fail(".do() after .join() didn't fire");
    }, 100);
    var tj = setTimeout(function () {
        t.fail('.join() never fired');
    }, 100);
    
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
            clearTimeout(tj);
            joined = true;
        })
        .do(function () {
            clearTimeout(to);
            t.ok(joined);
        })
    ;
});

test('jump', function (t) {
    var to = setTimeout(function () {
        t.fail('builder never fired');
    }, 50);
    
    var xs = [ 4, 5, 6, -4, 8, 9, -1, 8 ];
    var xs_ = [];
    
    var ch = chainsaw(function (saw) {
        this.x = function (i) {
            xs_.push(i);
            saw.next();
        };
        
        this.y = function (step) {
            var x = xs.shift();
            if (x > 0) saw.jump(step);
            else saw.next();
        };
        
        saw.on('end', function () {
            clearTimeout(to);
            t.same(xs, [ 8 ]);
            t.same(xs_, [ 1, 1, 1, 1, 2, 3, 2, 3, 2, 3 ]);
        });
    });
    
    ch
        .x(1)
        .y(0)
        .x(2)
        .x(3)
        .y(2)
    ;
});
