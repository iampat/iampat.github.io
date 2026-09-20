(function () {
  "use strict";

  var ORDER = ["v1", "v2", "v3", "v4"];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildPhoto(data, block) {
    block = block || document.getElementById("photo-block");
    var img = el("img");
    img.src = data.photo;
    img.alt = "Original photo";
    img.width = 1440;
    img.height = 1920;
    var cap = el("p", "cap", "Original photo");
    block.appendChild(img);
    block.appendChild(cap);
  }

  function buildCard(item) {
    var card = el("div", "card");

    if (item.ready === false) {
      var pending = el("div", "pending", "rendering");
      card.appendChild(pending);
    } else {
      var media = el("div", "media");

      var link = el("a");
      link.href = item.image;
      link.target = "_blank";
      link.rel = "noopener";
      var img = el("img", "final");
      img.src = item.image;
      img.alt = item.title;
      link.appendChild(img);
      media.appendChild(link);

      var video = el("video");
      video.controls = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = item.poster;
      var source = el("source");
      source.src = item.video;
      source.type = "video/mp4";
      video.appendChild(source);
      media.appendChild(video);

      card.appendChild(media);
    }

    var h3 = el("h3", null, item.title);
    var note = el("p", "note", item.note);
    card.appendChild(h3);
    card.appendChild(note);

    return card;
  }

  function buildVersions(data, host) {
    var root = document.getElementById("versions");
    host = host || root;
    var items = data.items || [];
    var wanted = (root.getAttribute("data-versions") || ORDER.join(",")).split(",");

    ORDER.filter(function (key) { return wanted.indexOf(key) >= 0; }).forEach(function (key) {
      var meta = data.versions && data.versions[key];
      if (!meta) return;
      var itemsForVersion = items.filter(function (it) {
        return it.version === key;
      });
      if (itemsForVersion.length === 0) return;

      var section = el("section", "version");
      section.id = key;
      section.appendChild(el("h2", null, meta.title));
      section.appendChild(el("p", "note", meta.note));

      var grid = el("div", "grid");
      itemsForVersion.forEach(function (item) {
        grid.appendChild(buildCard(item));
      });
      section.appendChild(grid);

      host.appendChild(section);
    });
  }

  function render(data) {
    var h1 = document.getElementById("page-title");
    var title = h1.getAttribute("data-title") || data.title || "Gallery";
    document.title = title;
    h1.textContent = title;
    if (Array.isArray(data.subjects)) {
      // several photos on one page: a block per subject, each with its own photo and cards
      var root = document.getElementById("versions");
      data.subjects.forEach(function (subject) {
        var block = el("section", "subject");
        block.appendChild(el("h2", null, subject.title));
        var photo = el("div", "photo-block");
        buildPhoto(subject, photo);
        block.appendChild(photo);
        buildVersions(subject, block);
        root.appendChild(block);
      });
      return;
    }
    buildPhoto(data);
    buildVersions(data);
  }

  function loadInline() {
    var node = document.getElementById("gallery-data");
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (err) {
      return null;
    }
  }

  function start() {
    // file:// blocks fetch of local JSON in some browsers, and the failed
    // request itself logs a console error. Skip straight to the inline
    // copy in that case instead of trying and catching.
    if (window.location.protocol === "file:") {
      var inline = loadInline();
      if (inline) {
        render(inline);
      } else {
        document.getElementById("page-title").textContent = "Could not load gallery.json";
      }
      return;
    }

    fetch(document.getElementById("versions").getAttribute("data-manifest") || "gallery.json")
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(render)
      .catch(function () {
        var data = loadInline();
        if (data) {
          render(data);
        } else {
          document.getElementById("page-title").textContent = "Could not load gallery.json";
        }
      });
  }

  start();
})();
