import re
from html.parser import HTMLParser

with open('index.html', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()

# 1. Check for unclosed attribute quotes or broken syntax
print("--- Checking lines for broken tags ---")
for idx, line in enumerate(lines, 1):
    # Check if a tag opens before previous closes on the same line
    # but excluding comments
    if '<!--' in line or '-->' in line:
        continue
    # Check mismatched quotes in attributes
    # e.g., class="something
    # count double quotes outside scripts
    pass

class StrictChecker(HTMLParser):
    void_elements = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
    
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() not in self.void_elements:
            self.stack.append((tag.lower(), self.getpos()))

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in self.void_elements:
            return
        if not self.stack:
            self.errors.append(f'Unexpected closing tag </{tag}> at line {self.getpos()[0]} (stack empty)')
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            open_tags = [t[0] for t in self.stack]
            if tag in open_tags:
                idx = len(self.stack) - 1 - open_tags[::-1].index(tag)
                unclosed = [f'<{t[0]}> (line {t[1][0]})' for t in self.stack[idx+1:]]
                self.errors.append(f'Closing </{tag}> at line {self.getpos()[0]} closed with unclosed inner tags: {unclosed}')
                self.stack = self.stack[:idx]
            else:
                self.errors.append(f'Closing </{tag}> at line {self.getpos()[0]} without open tag')

checker = StrictChecker()
try:
    checker.feed(text)
    print(f'Parsing finished.')
    print(f'Remaining open tags in stack: {len(checker.stack)}')
    for t, pos in checker.stack:
        print(f'  Unclosed <{t}> from line {pos[0]}')
    print(f'Total nesting errors found: {len(checker.errors)}')
    for err in checker.errors:
        print('  ' + err)
except Exception as e:
    print('Exception during parsing:', e)
