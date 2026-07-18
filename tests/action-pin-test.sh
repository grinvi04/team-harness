#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mapfile_cmd() { rg --files "$ROOT/.github" "$ROOT/templates/ci" -g '*.yml' -g '*.yaml'; }

ruby -ryaml -e '
def refs(value, path = [], found = [])
  case value
  when Hash
    value.each do |key, child|
      found << [path, child] if key == "uses"
      refs(child, path + [key.to_s], found)
    end
  when Array
    value.each_with_index { |child, index| refs(child, path + [index.to_s], found) }
  end
  found
end

def pinned?(value)
  return false unless value.is_a?(String)
  return true if value.start_with?("./")
  return !!(value =~ %r{\Adocker://.+@sha256:[0-9a-f]{64}\z}) if value.start_with?("docker://")
  !!(value =~ /@[0-9a-f]{40}\z/)
end

bad = []
ARGV.each do |file|
  begin
    doc = YAML.safe_load(File.read(file), [], [], true)
    refs(doc).each { |path, value| bad << "#{file}:#{path.join(".")}: #{value}" unless pinned?(value) }
  rescue Psych::Exception => error
    warn "FAIL: YAML parse #{file}: #{error.message}"
    exit 1
  end
end

fixtures = {
  "quoted SHA" => ["uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd", true],
  "movable tag" => ["uses: actions/checkout@v5", false],
  "local action" => ["uses: ./local-action", true],
  "flow mapping" => ["step: {uses: actions/checkout@v5}", false],
  "mutable docker" => ["uses: docker://alpine:3.8", false],
  "digest docker" => ["uses: docker://alpine@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", true],
  "escaped key" => [%("\\x75ses": actions/checkout@v5), false]
}
fixtures.each do |name, (yaml, expected)|
  values = refs(YAML.safe_load(yaml)).map(&:last)
  actual = values.length == 1 && pinned?(values.first)
  abort "FAIL: parser self-contract #{name}" unless actual == expected
end
alias_doc = YAML.safe_load("base: &step\n  uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd\ncopy: *step\n", [], [], true)
abort "FAIL: YAML alias Action 오탐" unless refs(alias_doc).all? { |_, value| pinned?(value) }

unless bad.empty?
  warn "FAIL: 가변 또는 비-SHA Action 참조\n#{bad.join("\n")}"
  exit 1
end
puts "PASS: YAML AST 외부 Action 참조 full SHA 고정"
' $(mapfile_cmd)
