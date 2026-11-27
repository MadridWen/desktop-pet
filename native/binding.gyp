{
  "targets": [
    {
      "target_name": "input",
      "sources": ["addon.cc"],
      "conditions": [
        ["OS=='win'", { "sources": ["win.cc"], "libraries": ["user32.lib"] }],
        ["OS=='mac'", {
          "sources": ["mac.cc"],
          "libraries": ["-framework ApplicationServices", "-framework CoreFoundation"],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "12.0"
          }
        }],
        ["OS!='win' and OS!='mac'", { "sources": ["unsupported.cc"] }]
      ]
    }
  ]
}
