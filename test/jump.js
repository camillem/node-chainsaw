var test = require('tap').test;
var chainsaw = require('../');

test('jump', function (t) {
    t.plan(2);
    
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
