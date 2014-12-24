$(document).ready(function() {
  // constants
  const refreshDataRate = 1000;
  const sidebarRefreshRate = 5000;
  const agentAddress = "https://agent.electricimp.com/Q55EE8z8iNZE";
  const tagRef = new Firebase ("https://bletracker.firebaseio.com/tags")

  // variables
  var tagNamesById = {};
  var demoTags = [];
  var availableTags = {};
  var sidebarRefresh, dataRefreshLoop;
  var defaultDashMsg = "Click on a Tag to see Data!"
  var disconnectCounter = 0;
  var connectionCounter = 0;
  var connected = false;

  // chart settings
  var accelGraphData = [{label: "x", data:[]}, {label: "y", data:[]}, {label: "z", data:[]}];
  var graphOptions = {
    xaxis: {
        color: "#CCCCCC",
        mode: "time",
        timeformat: "%I:%M:%S %P",
        timezone: "browser"
    },
    series: {
        lines: {
            shadowSize: 0,
            show: true,
            lineWidth: 1.5
        }
    },
    grid: {
        backgroundColor: { colors: ["#7A7A7A", "#2B2B2B"] },
        // hoverable: true,
        // autoHighlight: true,
    },
    legend: {
      show: true,
      position: "nw",
      backgroundColor: "#7A7A7A",
      backgroundOpacity: 0.2,
      margin: 10
    },
  };

  // listeners
  $(".nav-sidebar").on("click", "li", connect);
  $("#disconnect").on("click", disconnect);

  // Runtime(on page load)
  getTagNames(loadPage);
  checkConnectionStatus();


  ////// Page Functions //////
  function checkConnectionStatus() {
    getConnectedDevice();
  }

  function loadPage() {
    getDevices(updateSidebar);
    //show instructions or connected tag data

    pollForActiveDevices();
  }

  function updateSidebar() {
    updateDemoTagSidebar()
    updateAssetTagSidebar()
    updateTimestamp()
  }

  function updateDemoTagSidebar() {
    for (var i in demoTags) {
      var id = demoTags[i];
      var text = "Tag: " + tagNamesById[id] + " RSSI: "
      var listItem = $("[data-id="+id+"] a");

      if ( id in availableTags ) {
        updateSidebarListItem(listItem, text + availableTags[id].rssi);
      } else {
        updateSidebarListItem(listItem, text + "N/A");
      }
    }
  }

  function updateAssetTagSidebar() {
    clearAssetTagSidebar();
    var assetSidebar = $(".asset-tags")
    for (tagId in availableTags) {
      if (!availableTags[tagId].demoTag && availableTags[tagId].rssi > -85) {
        var text = "Tag: " + availableTags[tagId].name + " RSSI: " + availableTags[tagId].rssi;
        addSidebarListItem(assetSidebar, tagId, text);
      }
    }
  }

  function connect(e) {
    e.preventDefault();
    var tagId = e.currentTarget.dataset.id;
    // if (getActiveSidebarId()) {
    //   clearDataRefreshLoop();
    //   clearAccGraph();
    // };
    connectToDevice(tagId);
  }

  function loadDashboard(tagId) {
    console.log("connected to :" + tagId);
    showDisconnectButton();
    getData();
    hideDashboardMessage();
  }

  function disconnect(e) {
    e.preventDefault();
    disconnectFromDevice(); //API disconnect
    disconnectReset(defaultDashMsg);
  };

  function disconnectReset(message) {
    $(".sidebar .active").removeClass("active");
    hideDisconnectButton();
    clearDataRefreshLoop();
    clearAccGraph();
    hideDashboard();
    showDashboardMessage(message);
  }

  function getCurrentTime() {
    return (new Date()).toLocaleTimeString();
  }


  //// View Functions ////
  function clearDemoTagSidebar() {
    $(".demo-tags").html("");
  }

  function clearAssetTagSidebar() {
    $(".asset-tags").html("");
  }

  function addSidebarListItem(list, id, listText) {
    list.append("<li data-id='" + id + "'><a href='#'>" + listText + "</a></li>")
  }

  function updateSidebarListItem(listItem, listText) {
    listItem.text(listText);
  }

  function updateTimestamp() {
    $(".time").text("Devices Updated at " + getCurrentTime());
  }

  function showDisconnectButton() {
    $("#disconnect").removeClass("hidden");
  };

  function hideDisconnectButton() {
    $("#disconnect").addClass("hidden");
  };

  function updateDashboard(data) {
    console.log(data);
    $(".readings").removeClass("hidden");
    for (k in data) {
      $("." + k + " .reading").text(data[k]);
    }
    graphAccData(data.accel);
  };

  function hideDashboard() {
    $(".readings").addClass("hidden");
  }

  function graphAccData(accelData) {
    var startTime = Date.now() - 1000
    for (var i = 0; i < accelData.length; i++) {
      for (var j = 0; j < accelGraphData.length; j++) {
        accelGraphData[j].data.push([startTime, accelData[i][j]]);
      }
      startTime += 100;
    }
    var plot = $.plot("#chart_div", accelGraphData, graphOptions);
    plot.setupGrid();
    plot.draw();
  };

  function clearAccGraph() {
    $("#chart_div").html("");
    accelGraphData = [{label: "x", data:[]}, {label: "y", data:[]}, {label: "z", data:[]}];
  }

  function showDashboardMessage(message) {
    if (message === "trying to connect..." || message ===defaultDashMsg) {
      $(".dash-msg").text(message);
    } else {
      $(".dash-msg").text(message);
      setTimeout(function() {
        $(".dash-msg").text(defaultDashMsg);
      }, 3000);
    }
    $(".dash-msg").removeClass("hidden");
  }

  function hideDashboardMessage() {
    $(".dash-msg").addClass("hidden");
    $(".dash-msg").text(defaultDashMsg);
  }


  //// Loops ////
  function pollForActiveDevices() {
    if (!sidebarRefresh) {
      sidebarRefresh = window.setInterval(function() {
        getDevices(updateSidebar);
      }, sidebarRefreshRate);
    }
  }

  function clearSidebarRefresh() {
    window.clearInterval(sidebarRefresh);
    sidebarRefresh = undefined;
  }

  function connectionLoop(counter) {
    if (!connected) {
      getConnectedDevice();
      setTimeout(function () {
        if (--counter) {
          connectionLoop(counter);
        } else {
          console.log("connection failed");
          disconnectFromDevice(); //API disconnect
          disconnectReset("Connection Failed.  Select another Tag.");
        }
      }, 1000)
    }
  };

  function getData() {
    if (!dataRefreshLoop) {
      dataRefreshLoop = window.setInterval(function() { getSensorData(); }, refreshDataRate);
    }
  };

  function clearDataRefreshLoop() {
    window.clearInterval(dataRefreshLoop);
    dataRefreshLoop = undefined;
  }


  //// FIREBASE Functions ////

  // Get tagnames and demo tags from Firebase
  function getTagNames (callback) {
    tagRef.once("value", function(s) {
      buildTagObjs(s);
      if (callback) { callback(); }
    });
    tagRef.on("child_changed", function(s) {
      buildTagObjs(s);
      if (callback) { callback(); }
    });
  }

  // Loops through Firebase data to update
  // tagNamesById & demoTags variables
  function buildTagObjs(s) {
    s.forEach(function(tag) {
      tagNamesById[tag.key()] = tag.val().name;
      if (tag.val().funct === "dashboard-demo-tag") {
        demoTags.push(tag.key());
        addSidebarListItem($(".demo-tags"), tag.key(), "Tag: " + tag.val().name + " RSSI: N/A");
      }
    })
  }


  //// Gateway API Ajax requests ////

  //request avialable devices
  function getDevices(callback) {
    $.ajax({
      url : agentAddress + "/listdevs",
      dataType : "json",
      success : function(response) {
        //build availableTags
        for ( var tagId in response) {
          availableTags[tagId] = {"rssi" : response[tagId], "name" : tagNamesById[tagId]}
          if (demoTags.indexOf(tagId) >= 0) {
            availableTags[tagId]["demoTag"] = true;
          } else {
            availableTags[tagId]["demoTag"] = false;
          }
        }
        if (callback) { callback(); }
      }
    });
  }

  //request connected device
  //
  function getConnectedDevice() {
    $.ajax({
      url : agentAddress + "/getconnecteddev",
      success : function(response) {
        if (response) {
          connected = true;
          loadDashboard(response);
        }
      }
    });
    //response is deviceId or ""
  }


  //connect to a device
  //checks connection w/ getConnectedDevice
  function connectToDevice(devId) {
    $.ajax({
      url : agentAddress + "/connectto",
      type: "post",
      data: devId,
      success : function(response) {
        console.log("Connected " + response)
        console.log("trying to connect...");
        showDashboardMessage("trying to connect...");
        //confirm that we made a connection
        setTimeout(function() { connectionLoop(5); }, 600);
      }
    });
  }

  //disconnect from a device
  function disconnectFromDevice() {
    $.ajax({
      url : agentAddress + "/disconnect",
      success : function(response) {
        console.log("Disconnected: " + response);
        connected = false;
      }
    });
  }

  //get data from connected device
  function getSensorData() {
    $.ajax({
      url : agentAddress + "/getupdate",
      dataType : "json",
      success : function(response) {
        if(response.humid === null && response.temp === null && response.press === null && response.batt === null && response.mag.length === 0 && response.gyro.length === 0 && response.accel.length === 0) {
          console.log("null data")
          if (disconnectCounter < 4) {
            disconnectCounter++;
          } else {
            disconnectCounter = 0;
            disconnectFromDevice(); //API disconnect
            disconnectReset(defaultDashMsg);
          }
        } else {
          updateDashboard(response);
        }
        //response should look like
        // { "press": 1002.2, "humid": 22.4, "gyro": [ -104, 476, -462 ], "batt": 21, "temp": 21.6, "accel": [ [ 1, 0, 86 ], [ 1, -1, 87 ], [ 1, -1, 86 ], [ 2, -1, 86 ], [ 2, -1, 86 ], [ 1, 0, 86 ], [ 0, -1, 87 ], [ 2, -1, 86 ], [ 1, -1, 86 ], [ 2, -1, 86 ] ], "mag": [ -554, 903, -2347 ] }
      }
    });
  }
})