$(document).ready(function() {
  // constants
  const refreshDataRate = 1000;
  const sidebarRefreshRate = 5000;
  const agentAddress = "https://agent.electricimp.com/Q55EE8z8iNZE";
  const tagRef = new Firebase ("https://bletracker.firebaseio.com/tags")

  // variables
  var tagNamesById = {};
  var demoTags = []; //array of tag(s) set aside for dashboard demo
  var availableTags = {};
  var sidebarRefresh, dataRefreshLoop;
  var defaultDashMsg = "Click on a Tag to see Data!"
  var disconnectCounter = 0;
  var connectionCounter = 0;
  var connectedStatus = {"connected" : false, "tagId": ""};

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

  // gage settings
  var pressGauge = c3.generate({
    bindto: "#press-gauge",
    transition: { duration: 0 },
    data: {
      columns: [ ['data', 0] ],
      type: 'gauge',
    },
    gauge: {
      label: {
        format: function(value, ratio) {
          return value;
        },
      },
      min: 800,
      max: 1200,
    },
    color: {
      pattern: ['#FF0000', '#F97600', '#F6C600', '#60B044'], // the three color levels for the percentage values.
      threshold: {
        unit: 'value', // percentage is default
        max: 1300, // 100 is default
        values: [850, 950, 1050, 1150]
      }
    },
    interaction: { enabled: false },
    size: { height: 110 },
    padding: { bottom: 5 }
  });

  var humidGauge = c3.generate({
    bindto: "#humid-gauge",
    transition: { duration: 0 },
    data: {
      columns: [ ['data', 0] ],
      type: 'gauge',
    },
    gauge: {
      min: 0,
      max: 100,
    },
    color: {
      pattern: ['#FF0000', '#F97600', '#F6C600', '#60B044'], // the three color levels for the percentage values.
      threshold: {
        unit: 'value', // percentage is default
        max: 200, // 100 is default
        values: [30, 60, 90, 100]
      }
    },
    interaction: { enabled: false },
    size: { height: 110 },
    padding: { bottom: 5 }
  });

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
      var text = tagNamesById[id] + "    |    RSSI: "
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
      if ((!availableTags[tagId].demoTag && availableTags[tagId].rssi > -85) || !availableTags[tagId].demoTag && connectedStatus.tagId === tagId) {
        var text = availableTags[tagId].name + "    |    RSSI:   " + availableTags[tagId].rssi;
        addSidebarListItem(assetSidebar, tagId, text);
      }
    }
  }

  function connect(e) {
    e.preventDefault();
    var tagId = e.currentTarget.dataset.id;
    if (connectedStatus.connected) {
      connectedStatus = {"connected" : false, "tagId": ""};
      disconnectReset("");
      connectToDevice(tagId);
    } else {
      connectToDevice(tagId);
    }
  }

  function loadDashboard(tagId) {
    console.log("connected to :" + tagId);
    showDisconnectButton();
    setSidebarStatusToActive(tagId);
    getData();
    hideDashboardMessage();
  }

  function disconnect(e) {
    e.preventDefault();
    disconnectFromDevice(); //API disconnect
    disconnectReset(defaultDashMsg);
  };

  function disconnectReset(message) {
    removeSidebarStatusActive();
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
    list.append("<li data-id='" + id + "'><a href='#'>" + listText + "</a></li>");
    if (connectedStatus.connected && connectedStatus.tagId === id) {
      setSidebarStatusToActive(id);
    }
  }

  function updateSidebarListItem(listItem, listText) {
    listItem.text(listText);
  }

  function updateTimestamp() {
    $(".sidebar .time").text("Devices Updated at " + getCurrentTime());
  }

  function setSidebarStatusToActive(tagId) {
    removeSidebarStatusActive();
    $("[data-id=" + tagId + "]").addClass("active");
  }

  function removeSidebarStatusActive() {
    $(".sidebar .active").removeClass("active");
  }

  function getActiveSidebarId() {
    return ($(".sidebar .active").length > 0) ? $(".sidebar .active").data().id : "";
  }

  function showDisconnectButton() {
    $("#disconnect").removeClass("hidden");
  };

  function hideDisconnectButton() {
    $("#disconnect").addClass("hidden");
  };

  function updateDashboard(data) {
    // console.log(data);
    $(".readings").removeClass("hidden");
    for (reading in data) {
      $("." + reading + " .reading").text(data[reading]);
      if (reading === "temp") {
        $(".temp h2").text(data[reading] + " °C")
        $(".widget .time").text("updated @ " + new Date().toLocaleTimeString())
      }
      if (reading === "press") {
        pressGauge.load({
          columns: [
            [ 'data', data[reading] ]
          ]
        });
      }
      if (reading === "humid") {
        humidGauge.load({
          columns: [
            [ 'data', data[reading] ]
          ]
        });
      }
      if (reading === "mag") {
        for (i in reading) {
          $("." + reading + "-" + i).text(data[reading][i]);
        }
      }
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
        if (accelGraphData[j].data.length > 200) {
          accelGraphData[j].data = accelGraphData[j].data.slice(-200)
        };
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
    if (message ==="Trying to Connect . . ." || message === defaultDashMsg || message === "") {
      $(".dash-msg h3").html(message);
    } else {
      $(".dash-msg h3").html(message);
      setTimeout(function() {
        $(".dash-msg h3").html(defaultDashMsg);
      }, 4000);
    }
    $(".dash-msg").removeClass("hidden");
  }

  function hideDashboardMessage() {
    $(".dash-msg").addClass("hidden");
    $(".dash-msg h3").text(defaultDashMsg);
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
    if (!connectedStatus.connected) {
      getConnectedDevice();
      setTimeout(function () {
        if (--counter) {
          connectionLoop(counter);
        } else {
          console.log("connection failed");
          disconnectFromDevice(); //API disconnect
          disconnectReset("Connection Failed . . . Select another Tag.");
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
  // Takes a callback function as a parameter
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
        addSidebarListItem($(".demo-tags"), tag.key(), tag.val().name + "    |    RSSI: N/A");
      }
    })
  }


  //// Gateway API Ajax requests ////

  //requests a list of devices that are currently in range.
  //stores response in availableTags object
  //takes a callback as a parameter.
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

  //requests connected device
  //response is either deviceId or ""
  //if device is connected will loadDashboard
  function getConnectedDevice() {
    $.ajax({
      url : agentAddress + "/getconnecteddev",
      success : function(response) {
        if (response) {
          connectedStatus = {"connected" : true, "tagId" : response };
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
        showDashboardMessage("Trying to Connect . . .");
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
        connectedStatus = {"connected" : false, "tagId": ""};
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
            disconnectReset("Device not Responding . . . Disconnected from Device.");
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