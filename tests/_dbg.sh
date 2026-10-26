#!/bin/bash
# usage: tests/_dbg.sh snippet.js   (snippet = async code using the cmdr300 helpers; it can push to out via ok())
cd /home/user/moonshot-lookup-tools
python3 - "$1" <<'P'
import sys
head=open('tests/_dbg_head.txt').read()
snip=open(sys.argv[1]).read()
foot='''
%s
        } catch (e) { out.push(['threw', false, String(e.stack).split('\\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    console.log(JSON.stringify(r, null, 1).slice(0, 8000));
    await h.close();
    process.exit(0);
})();
''' % snip
open('tests/_dbg.js','w').write(head+foot)
P
node tests/_dbg.js
